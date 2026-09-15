// Fetch Roboto fonts and cache them for the lifetime of this server process.
let cachedFontBuffers: { normal: Buffer; bold: Buffer; italics: Buffer; bolditalics: Buffer } | null = null;

// We resolve the actual .ttf file URLs from Google's CSS API at request time
// instead of hardcoding gstatic.com URLs with a specific version hash. Google
// periodically rotates those hashes (e.g. v47 -> v51), which silently 404s any
// hardcoded URL and breaks PDF generation with an opaque "Unknown font format"
// error. Resolving dynamically makes this self-healing across those rotations.
// Shared by every PDF generator in the app (sales invoices, subscription
// invoices, etc.) so we only fetch/cache the fonts once per process.
export async function getRobotoFonts() {
  if (cachedFontBuffers) return cachedFontBuffers;

  const cssResponse = await fetch(
    "https://fonts.googleapis.com/css?family=Roboto:400,700,400italic,700italic"
  );
  if (!cssResponse.ok) {
    throw new Error(`Failed to fetch Roboto font metadata (status ${cssResponse.status})`);
  }
  const css = await cssResponse.text();

  const faces: { style: string; weight: string; url: string }[] = [];
  const blockRegex = /@font-face\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(css)) !== null) {
    const block = match[1];
    const styleMatch = block.match(/font-style:\s*(\w+)/);
    const weightMatch = block.match(/font-weight:\s*(\d+)/);
    const urlMatch = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/);
    if (styleMatch && weightMatch && urlMatch) {
      faces.push({ style: styleMatch[1], weight: weightMatch[1], url: urlMatch[1] });
    }
  }

  const findUrl = (style: string, weight: string) =>
    faces.find((f) => f.style === style && f.weight === weight)?.url;

  const normalUrl = findUrl("normal", "400");
  const boldUrl = findUrl("normal", "700");
  const italicUrl = findUrl("italic", "400");
  const boldItalicUrl = findUrl("italic", "700");

  if (!normalUrl || !boldUrl || !italicUrl || !boldItalicUrl) {
    throw new Error("Failed to resolve Roboto font URLs from Google Fonts CSS");
  }

  const [normal, bold, italics, bolditalics] = await Promise.all([
    fetch(normalUrl).then((r) => r.arrayBuffer()),
    fetch(boldUrl).then((r) => r.arrayBuffer()),
    fetch(italicUrl).then((r) => r.arrayBuffer()),
    fetch(boldItalicUrl).then((r) => r.arrayBuffer()),
  ]);
  cachedFontBuffers = {
    normal: Buffer.from(normal),
    bold: Buffer.from(bold),
    italics: Buffer.from(italics),
    bolditalics: Buffer.from(bolditalics),
  };
  return cachedFontBuffers;
}
