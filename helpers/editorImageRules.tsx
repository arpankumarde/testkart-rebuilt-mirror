/**
 * Rules for images inside rich text - question text, options, solutions and descriptions - shared
 * by the teacher editor image endpoints. Free of server imports, so specs can run it.
 */

export const EDITOR_IMAGE_FOLDER = "editor-images";

export const EDITOR_IMAGE_CONTENT_TYPES: ["image/jpeg", "image/png", "image/gif", "image/webp"] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export type EditorImageContentType = (typeof EDITOR_IMAGE_CONTENT_TYPES)[number];

const EXTENSIONS: Record<EditorImageContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export const EDITOR_IMAGE_TYPE_MESSAGE = "Only JPEG, PNG, GIF and WebP images can be used in the editor.";

export const PRIVATE_ADDRESS_MESSAGE = "The image link points to a private or reserved network address.";

export function editorImageTooLargeMessage(maxMb: number): string {
  return `Editor images must be ${maxMb} MB or smaller.`;
}

export function editorImageKey(contentType: EditorImageContentType): string {
  return `${EDITOR_IMAGE_FOLDER}/${crypto.randomUUID()}.${EXTENSIONS[contentType]}`;
}

function hasBytes(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

/** The type the bytes really are, whatever the sender declared. Null for anything else, SVG included. */
export function sniffEditorImageType(bytes: Uint8Array): EditorImageContentType | null {
  if (hasBytes(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (hasBytes(bytes, [0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) {
    return "image/gif";
  }
  if (hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && hasBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

/** Base64 with any data: URL prefix and whitespace removed and padding restored, or null if it is not base64. */
export function normaliseBase64(input: string): string | null {
  const compact = input
    .trim()
    .replace(/^data:[^,]*;base64,/i, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/=+$/, "");
  if (!compact || compact.length % 4 === 1 || !/^[A-Za-z0-9+/]+$/.test(compact)) return null;
  return compact.padEnd(Math.ceil(compact.length / 4) * 4, "=");
}

/** Decoded size of normalised base64, so an oversized image is refused before it is decoded. */
export function base64DecodedSize(normalised: string): number {
  const padding = normalised.endsWith("==") ? 2 : normalised.endsWith("=") ? 1 : 0;
  return (normalised.length / 4) * 3 - padding;
}

export function decodeBase64(normalised: string): Uint8Array {
  const binary = atob(normalised);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4 || !parts.every((part) => /^[0-9]{1,3}$/.test(part))) return null;
  const bytes = parts.map(Number);
  return bytes.every((byte) => byte <= 255) ? bytes : null;
}

function parseIpv6(address: string): number[] | null {
  let text = address.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
  if (text.includes(".")) {
    const lastColon = text.lastIndexOf(":");
    const embedded = lastColon < 0 ? null : parseIpv4(text.slice(lastColon + 1));
    if (!embedded) return null;
    const high = ((embedded[0] << 8) | embedded[1]).toString(16);
    const low = ((embedded[2] << 8) | embedded[3]).toString(16);
    text = `${text.slice(0, lastColon + 1)}${high}:${low}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const gap = 8 - head.length - tail.length;
  if (halves.length === 1 ? gap !== 0 : gap < 1) return null;
  const groups = [...head, ...new Array<string>(halves.length === 2 ? gap : 0).fill("0"), ...tail];
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.flatMap((group) => {
    const value = parseInt(group, 16);
    return [value >> 8, value & 0xff];
  });
}

type Prefix = { base: number[]; length: number };

function prefixes(list: Array<[string, number]>, parse: (address: string) => number[] | null): Prefix[] {
  return list.map(([address, length]) => ({ base: parse(address) as number[], length }));
}

function inPrefix(bytes: number[], { base, length }: Prefix): boolean {
  for (let bit = 0; bit < length; bit++) {
    const mask = 0x80 >> (bit % 8);
    if ((bytes[bit >> 3] & mask) !== (base[bit >> 3] & mask)) return false;
  }
  return true;
}

const BLOCKED_IPV4 = prefixes(
  [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ],
  parseIpv4
);

const [IPV4_MAPPED, GLOBAL_UNICAST, ...BLOCKED_IPV6] = prefixes(
  [
    ["::ffff:0:0", 96],
    ["2000::", 3],
    ["2001::", 32],
    ["2001:db8::", 32],
    ["2002::", 16],
  ],
  parseIpv6
);

/**
 * True only for globally routable unicast addresses. Private, loopback, link-local, shared,
 * documentation, multicast and tunnelling ranges are refused, as is anything unparseable.
 */
export function isPublicIpAddress(address: string): boolean {
  const ipv4 = parseIpv4(address);
  if (ipv4) return !BLOCKED_IPV4.some((prefix) => inPrefix(ipv4, prefix));
  const ipv6 = parseIpv6(address);
  if (!ipv6) return false;
  if (inPrefix(ipv6, IPV4_MAPPED)) return isPublicIpAddress(ipv6.slice(12).join("."));
  if (!inPrefix(ipv6, GLOBAL_UNICAST)) return false;
  return !BLOCKED_IPV6.some((prefix) => inPrefix(ipv6, prefix));
}

/** Why a link must not be fetched, or null: https on the default port, no credentials, no private literal IP. */
export function editorImageUrlProblem(url: URL): string | null {
  if (url.protocol !== "https:") return "The image link must start with https://.";
  if (url.port) return "The image link must use the standard https port.";
  if (url.username || url.password) return "The image link must not contain a user name or password.";
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const isLiteralIp = parseIpv4(host) !== null || host.includes(":");
  if (isLiteralIp && !isPublicIpAddress(host)) return PRIVATE_ADDRESS_MESSAGE;
  return null;
}