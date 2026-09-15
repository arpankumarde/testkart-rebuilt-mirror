import {
  base64DecodedSize,
  decodeBase64,
  editorImageUrlProblem,
  isPublicIpAddress,
  normaliseBase64,
  sniffEditorImageType,
} from "./editorImageRules";

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));
const bytes = (...parts: number[][]) => new Uint8Array(parts.flat());

describe("sniffEditorImageType", () => {
  it("reads the four editor image types from their bytes", () => {
    expect(sniffEditorImageType(bytes([0xff, 0xd8, 0xff, 0xe0], [0, 0, 0, 0]))).toBe("image/jpeg");
    expect(sniffEditorImageType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffEditorImageType(bytes(ascii("GIF89a"), [1, 0]))).toBe("image/gif");
    expect(sniffEditorImageType(bytes(ascii("GIF87a"), [1, 0]))).toBe("image/gif");
    expect(sniffEditorImageType(bytes(ascii("RIFF"), [0, 0, 0, 0], ascii("WEBPVP8 ")))).toBe("image/webp");
  });

  it("refuses SVG, HTML, other RIFF files and truncated headers", () => {
    const results = [
      bytes(ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),
      bytes(ascii("<!doctype html><html>")),
      bytes(ascii("RIFF"), [0, 0, 0, 0], ascii("WAVEfmt ")),
      bytes(ascii("GIF88a")),
      bytes([0xff, 0xd8]),
      bytes(),
    ].map(sniffEditorImageType);
    expect(results).toEqual([null, null, null, null, null, null]);
  });
});

describe("isPublicIpAddress", () => {
  it("allows public IPv4 and IPv6 addresses", () => {
    const refused = [
      "8.8.8.8",
      "1.1.1.1",
      "172.32.0.1",
      "104.18.10.10",
      "2606:4700::6810:84e5",
      "2a00:1450:4009:81f::200e",
      "::ffff:8.8.8.8",
    ].filter((address) => !isPublicIpAddress(address));
    expect(refused).toEqual([]);
  });

  it("refuses private, loopback, link-local, shared, reserved and malformed addresses", () => {
    const allowed = [
      "10.1.2.3",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "100.64.0.1",
      "0.0.0.0",
      "255.255.255.255",
      "224.0.0.1",
      "198.18.0.1",
      "::",
      "::1",
      "[::1]",
      "fe80::1",
      "fe80::1%eth0",
      "fd00::1",
      "fc00::1",
      "ff02::1",
      "::ffff:127.0.0.1",
      "::ffff:a9fe:a9fe",
      "64:ff9b::a00:1",
      "2001:db8::1",
      "2002:a00:1::1",
      "2001:0:4136:e378:8000:63bf:3fff:fdd2",
      "not-an-ip",
      "1.2.3",
      "1.2.3.256",
      "1::2::3",
    ].filter((address) => isPublicIpAddress(address));
    expect(allowed).toEqual([]);
  });
});

describe("editorImageUrlProblem", () => {
  it("accepts plain https links", () => {
    expect(editorImageUrlProblem(new URL("https://cdn.testkart.in/editor-images/a.jpg"))).toBeNull();
    expect(editorImageUrlProblem(new URL("https://example.com:443/a.png"))).toBeNull();
    expect(editorImageUrlProblem(new URL("https://8.8.8.8/a.png"))).toBeNull();
  });

  it("refuses other schemes, ports, credentials and private literal hosts", () => {
    const accepted = [
      "http://example.com/a.png",
      "ftp://example.com/a.png",
      "https://example.com:8443/a.png",
      "https://user:pass@example.com/a.png",
      "https://127.0.0.1/a.png",
      "https://2130706433/a.png",
      "https://[::1]/a.png",
      "https://[::ffff:10.0.0.1]/a.png",
      "https://169.254.169.254/latest/meta-data",
    ].filter((link) => editorImageUrlProblem(new URL(link)) === null);
    expect(accepted).toEqual([]);
  });
});

describe("normaliseBase64", () => {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const plain = btoa(String.fromCharCode(...png));

  it("accepts plain, data URL, wrapped and unpadded base64", () => {
    const newline = String.fromCharCode(10);
    for (const input of [
      plain,
      `data:image/png;base64,${plain}`,
      `${plain.slice(0, 4)}${newline}${plain.slice(4)}`,
      plain.replace(/=+$/, ""),
    ]) {
      const normalised = normaliseBase64(input) as string;
      expect(normalised).toBe(plain);
      expect(base64DecodedSize(normalised)).toBe(png.length);
      expect(Array.from(decodeBase64(normalised))).toEqual(png);
    }
  });

  it("accepts URL-safe base64", () => {
    const normalised = normaliseBase64("-_-_") as string;
    expect(Array.from(decodeBase64(normalised))).toEqual([0xfb, 0xff, 0xbf]);
  });

  it("refuses text that is not base64", () => {
    const accepted = ["", "not base64!", "abcde", "data:image/png;base64,"].filter(
      (input) => normaliseBase64(input) !== null
    );
    expect(accepted).toEqual([]);
  });
});