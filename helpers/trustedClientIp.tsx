/**
 * The visitor's IP address, read only from headers a visitor cannot forge.
 *
 * Checked on this hosting (2026-11-17): a request's own X-Forwarded-For replaces the forwarded
 * chain, and CF-Connecting-IP, True-Client-IP and X-Real-IP pass through from the browser untouched,
 * so none of them can be trusted on their own. x-floot-client-ip and CloudFront-Viewer-Address are
 * overwritten at the edge with the address that actually connected.
 *
 * The live domain sits behind Cloudflare, so that connecting address is a Cloudflare server and the
 * visitor is in CF-Connecting-IP, which Cloudflare sets. That header is used only when the
 * connecting address is inside Cloudflare's published ranges; a request that reaches the origin
 * some other way gets its own connecting address.
 *
 * helpers/getClientIp delegates here, so every IP-based check in the app follows this rule.
 */

// https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6
const CLOUDFLARE_RANGES = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

type ParsedIp = { version: 4 | 6; value: bigint };

function parseIPv4(text: string): bigint | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;
  let value = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = (value << 8n) | BigInt(n);
  }
  return value;
}

function parseIPv6(text: string): bigint | null {
  let input = text.toLowerCase().split("%")[0];
  const tail: string[] = [];
  if (input.includes(".")) {
    const lastColon = input.lastIndexOf(":");
    if (lastColon === -1) return null;
    const v4 = parseIPv4(input.slice(lastColon + 1));
    if (v4 === null) return null;
    tail.push(((v4 >> 16n) & 0xffffn).toString(16), (v4 & 0xffffn).toString(16));
    input = input.slice(0, lastColon + 1);
    if (!input.endsWith("::")) input = input.slice(0, -1);
  }
  const halves = input.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const known = head.length + rest.length + tail.length;
  if (halves.length === 1 && known !== 8) return null;
  if (halves.length === 2 && known > 7) return null;
  const zeros: string[] = halves.length === 2 ? Array(8 - known).fill("0") : [];
  const all = [...head, ...zeros, ...rest, ...tail];
  let value = 0n;
  for (const group of all) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    value = (value << 16n) | BigInt(parseInt(group, 16));
  }
  return value;
}

function parseIp(text: string): ParsedIp | null {
  if (text.includes(":")) {
    const value = parseIPv6(text);
    if (value === null) return null;
    // An IPv4-mapped address (::ffff:a.b.c.d) is the IPv4 address.
    if (value >> 32n === 0xffffn) return { version: 4, value: value & 0xffffffffn };
    return { version: 6, value };
  }
  const value = parseIPv4(text);
  return value === null ? null : { version: 4, value };
}

function formatIp(ip: ParsedIp): string {
  if (ip.version === 4) {
    return [24n, 16n, 8n, 0n].map((shift) => String((ip.value >> shift) & 0xffn)).join(".");
  }
  const groups: string[] = [];
  for (let i = 7; i >= 0; i--) groups.push(((ip.value >> BigInt(i * 16)) & 0xffffn).toString(16));
  // Collapse the longest run of zero groups, as in the canonical form.
  let bestStart = -1;
  let bestLength = 0;
  for (let i = 0; i < 8; ) {
    if (groups[i] !== "0") {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && groups[j] === "0") j++;
    if (j - i > bestLength && j - i > 1) {
      bestStart = i;
      bestLength = j - i;
    }
    i = j;
  }
  if (bestStart === -1) return groups.join(":");
  return `${groups.slice(0, bestStart).join(":")}::${groups.slice(bestStart + bestLength).join(":")}`;
}

const RANGES = CLOUDFLARE_RANGES.map((cidr) => {
  const [base, bits] = cidr.split("/");
  const ip = parseIp(base)!;
  const width = ip.version === 4 ? 32n : 128n;
  const prefix = BigInt(Number(bits));
  return { version: ip.version, network: ip.value >> (width - prefix), shift: width - prefix };
});

export function isCloudflareIp(text: string): boolean {
  const ip = parseIp(text);
  if (!ip) return false;
  return RANGES.some((range) => range.version === ip.version && ip.value >> range.shift === range.network);
}

/** A valid IP in canonical form, or null. */
export function normalizeIp(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  const ip = parseIp(trimmed.replace(/^\[|\]$/g, ""));
  return ip ? formatIp(ip) : null;
}

/** CloudFront-Viewer-Address is "ip:port" for IPv4 and IPv6 alike. */
function stripPort(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const bracketed = trimmed.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) return bracketed[1];
  const lastColon = trimmed.lastIndexOf(":");
  return lastColon === -1 ? trimmed : trimmed.slice(0, lastColon);
}

export function getTrustedClientIp(request: Request): string | null {
  const headers = request.headers;
  const edge = normalizeIp(headers.get("x-floot-client-ip")) ?? normalizeIp(stripPort(headers.get("cloudfront-viewer-address")));
  if (!edge) return null;
  if (isCloudflareIp(edge)) {
    const visitor = normalizeIp(headers.get("cf-connecting-ip"));
    if (visitor) return visitor;
  }
  return edge;
}