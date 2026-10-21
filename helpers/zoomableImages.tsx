const TOKEN = /<a\b[^>]*>|<\/a\s*>|<img\b[^>]*>/gi;

const attr = (tag: string, name: string): string | null => {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? (match[2] ?? match[3] ?? match[4] ?? "") : null;
};

/* Icons and decorations stay plain: anything marked presentational, or
   declared 64px or smaller on either side. */
const isDecorative = (tag: string) => {
  if (attr(tag, "role") === "presentation" || attr(tag, "aria-hidden") === "true") return true;
  const width = parseInt(attr(tag, "width") ?? "", 10);
  const height = parseInt(attr(tag, "height") ?? "", 10);
  return (width > 0 && width <= 64) || (height > 0 && height <= 64);
};

/**
 * Wraps each content image in a <button class="tk-zoomable"> so it can be
 * opened in ImageLightbox: a real button gives keyboard and touch support
 * without per-image handlers. Images inside links keep the link's behaviour
 * and are left alone, as are decorative ones. A pure string pass on
 * sanitised HTML, so SSR and the client render the same markup; the image
 * tag itself is untouched.
 */
export function wrapZoomableImages(html: string): string {
  if (!html || !/<img\b/i.test(html)) return html;
  let linkDepth = 0;
  return html.replace(TOKEN, (tag) => {
    if (/^<\/a/i.test(tag)) {
      linkDepth = Math.max(0, linkDepth - 1);
      return tag;
    }
    if (/^<a\b/i.test(tag)) {
      linkDepth += 1;
      return tag;
    }
    if (linkDepth > 0 || isDecorative(tag)) return tag;
    const alt = (attr(tag, "alt") ?? "").trim().replace(/"/g, "&quot;");
    const label = alt ? `Enlarge image: ${alt}` : "Enlarge image";
    return `<button type="button" class="tk-zoomable" aria-label="${label}">${tag}</button>`;
  });
}
