/**
 * Utility for fetching PDF fonts (Roboto + Indian script fonts) for server-side pdfmake usage.
 */

// ── LaTeX → image rendering (for question/option/explanation formulas in PDFs) ──
// Questions store math as empty <span data-type="inline-math|block-math" data-latex="...">
// spans that are rendered client-side by KaTeX (see MathMLContent.tsx / RichTextEditor.tsx).
// pdfmake has no HTML/CSS/LaTeX renderer, so on the server we render each formula to SVG
// via MathJax (pure JS, no browser/DOM needed) and rasterize it to a small PNG via sharp,
// then embed it as a pdfmake image.
//
// mathjax-full (and sharp's native binding loader) reach for Node-only globals
// (__dirname) at module-evaluation time, which some non-Node bundling/preview
// contexts don't provide. Both are dynamically imported and only instantiated
// on first actual use, so this file has no problematic top-level side effects.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MathRenderer = {
  adaptor: { outerHTML: (node: any) => string };
  document: { convert: (latex: string, opts: { display: boolean }) => any };
};

let mathRendererPromise: Promise<MathRenderer> | null = null;

async function initMathRenderer(): Promise<MathRenderer> {
  const [{ mathjax }, { TeX }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }, { AllPackages }] =
    await Promise.all([
      import("mathjax-full/js/mathjax.js"),
      import("mathjax-full/js/input/tex.js"),
      import("mathjax-full/js/output/svg.js"),
      import("mathjax-full/js/adaptors/liteAdaptor.js"),
      import("mathjax-full/js/handlers/html.js"),
      import("mathjax-full/js/input/tex/AllPackages.js"),
    ]);
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const document = mathjax.document("", {
    InputJax: new TeX({ packages: AllPackages }),
    OutputJax: new SVG({ fontCache: "none" }),
  });
  return { adaptor, document };
}

function getMathRenderer(): Promise<MathRenderer> {
  if (!mathRendererPromise) {
    mathRendererPromise = initMathRenderer();
  }
  const promise = mathRendererPromise;
  return promise;
}

const mathImageCache = new Map<string, { dataUrl: string; widthPt: number } | null>();

function extractAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}=["']([^"']*)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

async function renderLatexToImageDataUrl(
  latex: string,
  displayMode: boolean
): Promise<{ dataUrl: string; widthPt: number } | null> {
  const cacheKey = `${displayMode ? "d" : "i"}:${latex}`;
  if (mathImageCache.has(cacheKey)) return mathImageCache.get(cacheKey)!;

  try {
    const renderer = await getMathRenderer();
    const node = renderer.document.convert(latex, { display: displayMode });
    const containerHtml = renderer.adaptor.outerHTML(node);
    const svgMatch = containerHtml.match(/<svg[\s\S]*<\/svg>/);
    if (!svgMatch) throw new Error("MathJax did not produce SVG output");
    const svgString = svgMatch[0];

    const widthMatch = svgString.match(/width="([\d.]+)ex"/);
    const heightMatch = svgString.match(/height="([\d.]+)ex"/);
    const wEx = widthMatch ? parseFloat(widthMatch[1]) : 4;
    const hEx = heightMatch ? parseFloat(heightMatch[1]) : 2;
    const aspect = wEx / hEx;

    const targetHeightPt = displayMode ? 20 : 13;
    const targetHeightPx = targetHeightPt * 4; // upscale for crisp print resolution
    const targetWidthPx = Math.max(1, Math.round(targetHeightPx * aspect));

    const sharp = (await import("sharp")).default;
    const pngBuffer = await sharp(Buffer.from(svgString), { density: 300 })
      .resize({ height: targetHeightPx })
      .png()
      .toBuffer();

    const result = {
      dataUrl: `data:image/png;base64,${pngBuffer.toString("base64")}`,
      widthPt: targetHeightPt * aspect,
    };
    mathImageCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error(`Failed to render LaTeX formula "${latex}":`, err);
    mathImageCache.set(cacheKey, null);
    return null;
  }
}

// ── Script detection ───────────────────────────────────────────────────────────

const SCRIPT_RANGES: Record<string, [number, number]> = {
  devanagari: [0x0900, 0x097f],
  bengali:    [0x0980, 0x09ff],
  gurmukhi:  [0x0a00, 0x0a7f],
  gujarati:  [0x0a80, 0x0aff],
  oriya:     [0x0b00, 0x0b7f],
  tamil:     [0x0b80, 0x0bff],
  telugu:    [0x0c00, 0x0c7f],
  kannada:   [0x0c80, 0x0cff],
  malayalam: [0x0d00, 0x0d7f],
};

export function detectScripts(text: string): Set<string> {
  const detected = new Set<string>();
  for (const char of text) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;
    for (const [script, [start, end]] of Object.entries(SCRIPT_RANGES)) {
      if (cp >= start && cp <= end) {
        detected.add(script);
      }
    }
  }
  return detected;
}

// ── Font config ────────────────────────────────────────────────────────────────

// IMPORTANT: These are FULL TTF files sourced from the Google Fonts GitHub repository
// (via cdn.jsdelivr.net/gh/google/fonts@main/ofl/...), NOT fontsource unicode-range subsets.
// Full TTFs include Latin characters, digits, punctuation, AND the Indian script glyphs all
// in a single file, which is essential for correct mixed-language rendering.
// Exception: Oriya (Odia) — no full static TTF is available in the Google Fonts repo,
// so it continues to use the fontsource unicode-range subset as a best-effort fallback.
const SCRIPT_FONT_CONFIG: Record<string, { fontName: string; regularUrl: string; boldUrl: string }> = {
  devanagari: {
    fontName: "Mukta",
    regularUrl: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/mukta/Mukta-Regular.ttf",
    boldUrl: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/mukta/Mukta-Bold.ttf",
  },
  gujarati: {
    fontName: "MuktaVaani",
    regularUrl: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/muktavaani/MuktaVaani-Regular.ttf",
    boldUrl: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/muktavaani/MuktaVaani-Bold.ttf",
  },
  bengali: {
    fontName: "HindSiliguri",
    regularUrl: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/hindsiliguri/HindSiliguri-Regular.ttf",
    boldUrl: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/hindsiliguri/HindSiliguri-Bold.ttf",
  },
  gurmukhi: {
    fontName: "MuktaMahee",
    regularUrl: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/muktamahee/MuktaMahee-Regular.ttf",
    boldUrl: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/muktamahee/MuktaMahee-Bold.ttf",
  },
  tamil: {
    fontName: "MuktaMalar",
    regularUrl: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/muktamalar/MuktaMalar-Regular.ttf",
    boldUrl: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/muktamalar/MuktaMalar-Bold.ttf",
  },
  telugu: {
    fontName: "HindGuntur",
    regularUrl: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/hindguntur/HindGuntur-Regular.ttf",
    boldUrl: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/hindguntur/HindGuntur-Bold.ttf",
  },
  kannada: {
    fontName: "HindMysuru",
    regularUrl: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/hindmysuru/HindMysuru-Regular.ttf",
    boldUrl: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/hindmysuru/HindMysuru-Bold.ttf",
  },
  malayalam: {
    fontName: "HindKochi",
    regularUrl: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/hindkochi/HindKochi-Regular.ttf",
    boldUrl: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/hindkochi/HindKochi-Bold.ttf",
  },
  oriya: {
    fontName: "NotoSansOriya",
    regularUrl: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-oriya@latest/oriya-400-normal.ttf",
    boldUrl: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-oriya@latest/oriya-700-normal.ttf",
  },
};

// Roboto font URLs (fetched at runtime to avoid relying on bundled local paths)
const ROBOTO_URLS = {
  regular: "https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/src/hinted/Roboto-Regular.ttf",
  medium: "https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/src/hinted/Roboto-Medium.ttf",
  italic: "https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/src/hinted/Roboto-Italic.ttf",
  mediumItalic: "https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/src/hinted/Roboto-MediumItalic.ttf",
};

export type PdfFontMap = Record<string, {
  normal: Buffer;
  bold: Buffer;
  italics: Buffer;
  bolditalics: Buffer;
}>;

export type FetchFontsResult = {
  fonts: PdfFontMap;
  defaultFont: string;
};

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function fetchScriptFonts(scripts: Set<string>): Promise<FetchFontsResult> {
  // Fetch all 4 Roboto variants in parallel upfront
  console.log("Fetching Roboto fonts from CDN...");
  const [robotoRegular, robotoMedium, robotoItalic, robotoMediumItalic] = await Promise.all([
    fetchBuffer(ROBOTO_URLS.regular),
    fetchBuffer(ROBOTO_URLS.medium),
    fetchBuffer(ROBOTO_URLS.italic),
    fetchBuffer(ROBOTO_URLS.mediumItalic),
  ]).catch((err) => {
    console.error("Failed to fetch Roboto fonts:", err);
    throw err;
  });
  console.log(`Roboto fonts fetched: regular=${robotoRegular.length}b, medium=${robotoMedium.length}b`);

  const fonts: PdfFontMap = {
    Roboto: {
      normal: robotoRegular,
      bold: robotoMedium,
      italics: robotoItalic,
      bolditalics: robotoMediumItalic,
    },
  };

  let defaultFont = "Roboto";
  let firstDetectedFontName: string | null = null;

  const scriptsToFetch = [...scripts].filter((s) => s in SCRIPT_FONT_CONFIG);

  if (scriptsToFetch.length === 0) {
    console.log("No Indian scripts detected, using Roboto.");
    return { fonts, defaultFont };
  }

  console.log(`Detected scripts: ${scriptsToFetch.join(", ")}. Fetching fonts in parallel...`);

  const results = await Promise.all(
    scriptsToFetch.map(async (script) => {
      const config = SCRIPT_FONT_CONFIG[script];
      try {
        console.log(`Fetching fonts for script '${script}': regular=${config.regularUrl}, bold=${config.boldUrl}`);
        const [regularBuffer, boldBuffer] = await Promise.all([
          fetchBuffer(config.regularUrl),
          fetchBuffer(config.boldUrl),
        ]);
        console.log(`Fonts for '${script}' (${config.fontName}) fetched: regular=${regularBuffer.length}b, bold=${boldBuffer.length}b`);
        return { script, fontName: config.fontName, regularBuffer, boldBuffer };
      } catch (err) {
        console.error(`Failed to fetch fonts for script '${script}':`, err);
        return null;
      }
    })
  );

  for (const result of results) {
    if (!result) continue;
    fonts[result.fontName] = {
      normal: result.regularBuffer,
      bold: result.boldBuffer,
      italics: result.regularBuffer,
      bolditalics: result.boldBuffer,
    };
    if (firstDetectedFontName === null) {
      firstDetectedFontName = result.fontName;
    }
  }

  if (firstDetectedFontName !== null) {
    defaultFont = firstDetectedFontName;
    console.log(`Default font set to: ${defaultFont}`);
  } else {
    console.warn("All Indian script font fetches failed, falling back to Roboto.");
  }

  return { fonts, defaultFont };
}

// ── HTML parsing ───────────────────────────────────────────────────────────────

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .trim();
}

export async function parseHtmlToPdfContent(
  html: string | null | undefined,
  textStyle?: string
): Promise<object[]> {
  if (!html) return [];

  const items: object[] = [];
  // Matches either an <img> tag, or a math span written by the rich text editor
  // (empty <span data-type="inline-math|block-math|mathematics" data-latex="...">).
  const embedRegex =
    /(<img[^>]+src=["']([^"']+)["'][^>]*>)|(<span\b[^>]*data-type=["'](?:inline-math|block-math|mathematics)["'][^>]*>[\s\S]*?<\/span>)/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  type EmbedMatch =
    | { kind: "image"; index: number; end: number; src: string }
    | { kind: "math"; index: number; end: number; latex: string; displayMode: boolean };

  const matches: EmbedMatch[] = [];
  while ((match = embedRegex.exec(html)) !== null) {
    if (match[2] !== undefined) {
      matches.push({ kind: "image", index: match.index, end: match.index + match[0].length, src: match[2] });
    } else if (match[3] !== undefined) {
      const tag = match[3];
      const rawLatex =
        extractAttr(tag, "data-katex-content") ??
        extractAttr(tag, "data-latex") ??
        extractAttr(tag, "data-math") ??
        extractAttr(tag, "data-formula");
      if (rawLatex) {
        const dataType = extractAttr(tag, "data-type");
        matches.push({
          kind: "math",
          index: match.index,
          end: match.index + match[0].length,
          latex: decodeHtmlEntities(rawLatex),
          displayMode: dataType === "block-math",
        });
      }
      // No latex attribute found: the span is empty/unrecognized, so it contributes
      // nothing and is simply left to fall through into the surrounding stripped text.
    }
  }

  const embedResults = await Promise.all(
    matches.map(async (m) => {
      if (m.kind === "image") {
        try {
          const response = await fetch(m.src);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const rawContentType = response.headers.get("content-type") || "image/jpeg";
          const contentType = rawContentType.split(";")[0].trim();
          const supportedTypes = ["image/jpeg", "image/jpg", "image/png"];
          if (!supportedTypes.includes(contentType)) {
            console.warn(`Unsupported image type '${contentType}' for ${m.src}, skipping`);
            return null;
          }
          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const dataUrl = `data:${contentType};base64,${base64}`;
          console.log(`Image fetched: ${m.src} -> type=${contentType}, base64 length=${base64.length}`);
          return { kind: "image" as const, dataUrl };
        } catch (err) {
          console.error(`Failed to fetch image at ${m.src}:`, err);
          return null;
        }
      }
      const rendered = await renderLatexToImageDataUrl(m.latex, m.displayMode);
      if (!rendered) return { kind: "math-fallback" as const, latex: m.latex };
      return { kind: "math" as const, dataUrl: rendered.dataUrl, widthPt: rendered.widthPt, displayMode: m.displayMode };
    })
  );

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];

    const textBefore = html.slice(lastIndex, m.index);
    const stripped = stripHtml(textBefore);
    if (stripped.trim()) {
      items.push({ text: stripped, ...(textStyle ? { style: textStyle } : {}) });
    }

    const result = embedResults[i];
    if (!result) {
      items.push({ text: "[Image could not be loaded]", italics: true, color: "#888888" });
    } else if (result.kind === "image") {
      items.push({ image: result.dataUrl, fit: [400, 300], margin: [0, 4, 0, 4] });
    } else if (result.kind === "math") {
      items.push({
        image: result.dataUrl,
        width: result.widthPt,
        margin: result.displayMode ? [0, 6, 0, 6] : [0, 2, 0, 2],
        alignment: result.displayMode ? "center" : "left",
      });
    } else {
      // MathJax failed to parse this formula (e.g. malformed LaTeX) — show the raw
      // source instead of silently dropping it, so nothing goes missing.
      items.push({ text: `[${result.latex}]`, italics: true, color: "#888888", ...(textStyle ? { style: textStyle } : {}) });
    }

    lastIndex = m.end;
  }

  const remaining = html.slice(lastIndex);
  const strippedRemaining = stripHtml(remaining);
  if (strippedRemaining.trim()) {
    items.push({ text: strippedRemaining, ...(textStyle ? { style: textStyle } : {}) });
  }

  return items;
}

export function collectQuestionText(q: {
  questionText: string;
  paragraphText: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  explanation: string | null;
}): string {
  return [
    q.questionText,
    q.paragraphText,
    q.optionA,
    q.optionB,
    q.optionC,
    q.optionD,
    q.explanation,
  ]
    .filter(Boolean)
    .join(" ");
}