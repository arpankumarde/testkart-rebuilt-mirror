import opentype from "opentype.js";
import { getRobotoFonts } from "./robotoPdfFonts";

export type PageWatermark =
  | { kind: "viewer"; userId: number; name: string | null; email: string | null; mobileNumber?: string | null }
  | { kind: "preview" };

const TEXT_COLOR = "#1f2937";
const TILE_OPACITY = 0.11;
const FOOTER_OPACITY = 0.75;
const WEBP_QUALITY = 80;
const OVERLAY_CACHE_SIZE = 16;
const SEPARATOR = " · ";

let fontPromise: Promise<opentype.Font> | null = null;
const overlayCache = new Map<string, Buffer>();

// Text is drawn as vector paths from a fetched font, because the server has no system fonts for SVG text.
function loadFont(): Promise<opentype.Font> {
  if (!fontPromise) {
    fontPromise = getRobotoFonts()
      .then(({ bold }) =>
        opentype.parse(bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength) as ArrayBuffer)
      )
      .catch((error) => {
        fontPromise = null;
        throw error;
      });
  }
  return fontPromise;
}

const maskEmail = (email: string | null) => {
  const [local, domain] = (email ?? "").trim().split("@");
  return local && domain ? `${local.slice(0, 2)}***@${domain}` : null;
};

const maskPhone = (mobileNumber: string | null | undefined) => {
  const digits = (mobileNumber ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? `******${digits.slice(-4)}` : null;
};

const todayInIndia = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("day")}-${part("month")}-${part("year")}`;
};

// Keeps only characters the font can draw, so a name in a script it lacks drops out instead of turning into boxes.
const drawable = (font: opentype.Font, text: string) =>
  Array.from(text)
    .filter((char) => char === " " || font.charToGlyphIndex(char) > 0)
    .join("")
    .replace(/\s+/g, " ")
    .trim();

function watermarkLines(font: opentype.Font, mark: PageWatermark) {
  if (mark.kind === "preview") {
    return { tile: `testkart.in${SEPARATOR}Preview`, footer: "Preview from testkart.in" };
  }
  const name = drawable(font, mark.name ?? "") || null;
  const contact = maskEmail(mark.email) ?? maskPhone(mark.mobileNumber);
  const tile = [name, contact].filter(Boolean).join(SEPARATOR) || `Testkart user ${mark.userId}`;
  const footer = [
    `Licensed to ${name ?? contact ?? `user ${mark.userId}`}`,
    name ? contact : null,
    `ID ${mark.userId}`,
    todayInIndia(),
  ]
    .filter(Boolean)
    .join(SEPARATOR);
  return { tile: drawable(font, tile), footer: drawable(font, footer) };
}

async function buildOverlay(font: opentype.Font, lines: { tile: string; footer: string }, width: number, height: number) {
  const tileSize = Math.max(14, Math.round(width * 0.026));
  const tilePath = font.getPath(lines.tile, 0, 0, tileSize);
  const tileBox = tilePath.getBoundingBox();
  const stepX = Math.max(tileSize, tileBox.x2 - tileBox.x1) + tileSize * 4;
  const stepY = tileSize * 7;

  // Tiles cover a box three times the page so the rotated grid leaves no bare corners.
  let uses = "";
  let row = 0;
  for (let y = -height; y < height * 2; y += stepY, row++) {
    for (let x = -width + (row % 2) * (stepX / 2); x < width * 2; x += stepX) {
      uses += `<use xlink:href="#t" x="${Math.round(x)}" y="${Math.round(y)}"/>`;
    }
  }

  const footerSize = Math.max(11, Math.round(width * 0.015));
  const footerBox = font.getPath(lines.footer, 0, 0, footerSize).getBoundingBox();
  const footerX = Math.max(footerSize, width - (footerBox.x2 - footerBox.x1) - footerSize);
  const footerData = font.getPath(lines.footer, footerX, height - footerSize, footerSize).toPathData(1);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}">` +
    `<defs><path id="t" d="${tilePath.toPathData(1)}"/></defs>` +
    `<g fill="${TEXT_COLOR}" fill-opacity="${TILE_OPACITY}" transform="rotate(-30 ${width / 2} ${height / 2})">${uses}</g>` +
    `<path d="${footerData}" fill="none" stroke="#ffffff" stroke-width="${(footerSize * 0.3).toFixed(1)}" stroke-linejoin="round"/>` +
    `<path d="${footerData}" fill="${TEXT_COLOR}" fill-opacity="${FOOTER_OPACITY}"/>` +
    `</svg>`;

  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Stamps a page image with who it was served to (or a preview mark) and returns it as WebP.
export async function watermarkPage(image: Uint8Array, mark: PageWatermark): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const [font, metadata] = await Promise.all([loadFont(), sharp(image).metadata()]);
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) {
    throw new Error("Page image has no size");
  }

  const lines = watermarkLines(font, mark);
  const cacheKey = `${width}x${height}|${lines.tile}|${lines.footer}`;
  let overlay = overlayCache.get(cacheKey);
  if (!overlay) {
    overlay = await buildOverlay(font, lines, width, height);
    if (overlayCache.size >= OVERLAY_CACHE_SIZE) {
      const oldest = overlayCache.keys().next().value;
      if (oldest !== undefined) overlayCache.delete(oldest);
    }
    overlayCache.set(cacheKey, overlay);
  }

  return sharp(image)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}