import { useEffect } from "react";

/**
 * Clickable tables of contents for rich-text articles (exam content pages).
 *
 * linkContentToc is a string pass, so server and client render the same markup:
 * it gives every h2-h4 a stable, unique id and turns the items of a "Table of
 * Contents" list (an h2-h4 or bold paragraph titled "Table of Contents",
 * "Contents", "In this guide", "What is on this page"...) into #id links. Items
 * are matched to the headings that follow the list by an in-order alignment on
 * weighted word overlap, since the item wording often differs from the heading
 * ("NEET UG at a glance" -> "NEET UG"). Items with no matching heading, or that
 * already hold a link, are left as they are.
 *
 * useContentToc adds the behaviour: smooth scrolling (instant under
 * prefers-reduced-motion) that clears the sticky header via scroll-margin-top
 * (.tk-toc-target in base.css), the hash in the URL, and the active item while
 * the reader scrolls.
 */

const HEADING = /<h([2-4])(\s[^>]*)?>([\s\S]*?)<\/h\1\s*>/gi;
const BOLD_PARAGRAPH = /<p(?:\s[^>]*)?>\s*<(strong|b)(?:\s[^>]*)?>([\s\S]{1,60}?)<\/\1>\s*<\/p\s*>/gi;
const TOC_TITLE = /^(table of contents|contents|in this (guide|article|page|post)|(what is|what's) on this page|on this page)$/;
const LIST_TAG = /<(\/?)(ul|ol)\b[^>]*>/gi;
const ITEM_LABEL_END = /<(?:ul|ol)\b|<\/li\s*>/i;
const SINGLE_PARAGRAPH = /^<p(\s[^>]*)?>([\s\S]*)<\/p\s*>$/i;
const ID_ATTR = /\sid\s*=\s*(["'])(.*?)\1/i;
const CLASS_ATTR = /\sclass\s*=\s*(["'])(.*?)\1/i;

const STOPWORDS = new Set(
  "a an and are as at be by can do does for from how i in into is it its of on or our the their this to vs what when where which who why will with you your".split(" ")
);
// Ids the app shell already uses.
const RESERVED_IDS = new Set(["root", "app", "main", "content", "header", "footer", "top"]);
const MIN_MATCH = 0.34;

type Heading = { start: number; openEnd: number; end: number; level: number; attrs: string; text: string; id: string };
type Edit = { start: number; end: number; text: string };

const decodeEntities = (value: string): string =>
  value
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");

const textOf = (html: string): string =>
  decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const normalize = (text: string): string =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\bcut[\s-]+off/g, "cutoff")
    .replace(/[:.]+$/, "")
    .trim();

// Plural to singular, enough for "Vacancies" to meet "Vacancy Details".
const stem = (token: string): string => {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
};

const tokensOf = (text: string): string[] => {
  const tokens = normalize(text)
    .replace(/'s\b/g, "")
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((token) => token && !STOPWORDS.has(token) && !/^\d+$/.test(token))
    .map(stem);
  return Array.from(new Set(tokens));
};

const slugify = (text: string): string =>
  normalize(text)
    .replace(/['"]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/, "");

// Weighted Dice overlap: words shared by many headings (the exam name, "syllabus")
// count for little, distinctive ones decide the match.
const similarity = (a: string[], b: string[], weight: (token: string) => number): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const inB = new Set(b);
  let shared = 0;
  let total = 0;
  for (const token of a) {
    total += weight(token);
    if (inB.has(token)) shared += weight(token);
  }
  for (const token of b) total += weight(token);
  return total === 0 ? 0 : (2 * shared) / total;
};

// Best in-order pairing of items to headings (each used once, order kept).
const alignInOrder = (scores: number[][]): Map<number, number> => {
  const rows = scores.length;
  const cols = rows ? scores[0].length : 0;
  const best = Array.from({ length: rows + 1 }, () => new Array<number>(cols + 1).fill(0));
  for (let i = 1; i <= rows; i++) {
    for (let j = 1; j <= cols; j++) {
      const score = scores[i - 1][j - 1];
      best[i][j] = Math.max(best[i - 1][j], best[i][j - 1], score >= MIN_MATCH ? best[i - 1][j - 1] + score : -Infinity);
    }
  }
  const pairs = new Map<number, number>();
  let i = rows;
  let j = cols;
  while (i > 0 && j > 0) {
    const score = scores[i - 1][j - 1];
    if (score >= MIN_MATCH && best[i][j] === best[i - 1][j - 1] + score) {
      pairs.set(i - 1, j - 1);
      i--;
      j--;
    } else if (best[i][j] === best[i - 1][j]) {
      i--;
    } else {
      j--;
    }
  }
  return pairs;
};

const withClass = (attrs: string, className: string): string => {
  const existing = attrs.match(CLASS_ATTR);
  if (!existing) return `${attrs} class="${className}"`;
  if (existing[2].split(/\s+/).includes(className)) return attrs;
  return attrs.replace(CLASS_ATTR, ` class="${existing[2]} ${className}"`);
};

const escapeAttr = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

// Index just past the list that opens at `start`, counting nested lists.
const listEnd = (html: string, start: number): number => {
  LIST_TAG.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = LIST_TAG.exec(html))) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return LIST_TAG.lastIndex;
  }
  return -1;
};

type TocList = { titleStart: number; titleId: string | null; listStart: number; listEnd: number };

const findTocLists = (html: string, headings: Heading[]): TocList[] => {
  const titles: { start: number; end: number; id: string | null }[] = [];
  for (const heading of headings) {
    if (TOC_TITLE.test(normalize(heading.text))) {
      titles.push({ start: heading.start, end: heading.end, id: heading.id });
    }
  }
  BOLD_PARAGRAPH.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BOLD_PARAGRAPH.exec(html))) {
    if (TOC_TITLE.test(normalize(textOf(match[2])))) {
      titles.push({ start: match.index, end: match.index + match[0].length, id: null });
    }
  }
  const lists: TocList[] = [];
  for (const title of titles.sort((a, b) => a.start - b.start)) {
    const rest = html.slice(title.end);
    const opening = rest.match(/^\s*<(ul|ol)\b/i);
    if (!opening) continue;
    const listStart = title.end + opening[0].indexOf("<");
    const end = listEnd(html, listStart);
    if (end > 0) lists.push({ titleStart: title.start, titleId: title.id, listStart, listEnd: end });
  }
  return lists;
};

export function linkContentToc(html: string): string {
  if (!html || !/<h[2-4][\s>]/i.test(html)) return html;

  const headings: Heading[] = [];
  const usedIds = new Set<string>(RESERVED_IDS);
  for (const match of html.matchAll(/\sid\s*=\s*["']([^"']+)["']/gi)) usedIds.add(match[1]);

  HEADING.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HEADING.exec(html))) {
    const attrs = match[2] ?? "";
    const text = textOf(match[3]);
    const existingId = attrs.match(ID_ATTR)?.[2];
    let id = existingId ?? "";
    if (!id) {
      const base = slugify(text) || "section";
      id = base;
      for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
      usedIds.add(id);
    }
    headings.push({
      start: match.index,
      openEnd: match.index + 3 + attrs.length + 1,
      end: match.index + match[0].length,
      level: Number(match[1]),
      attrs,
      text,
      id,
    });
  }
  if (headings.length === 0) return html;

  const edits: Edit[] = headings.map((heading) => {
    let attrs = withClass(heading.attrs, "tk-toc-target");
    if (!ID_ATTR.test(attrs)) attrs = ` id="${escapeAttr(heading.id)}"${attrs}`;
    return { start: heading.start, end: heading.openEnd, text: `<h${heading.level}${attrs}>` };
  });

  for (const toc of findTocLists(html, headings)) {
    const targets = headings.filter((heading) => heading.start >= toc.listEnd);
    if (targets.length === 0) continue;

    const items: { start: number; end: number; label: string }[] = [];
    const body = html.slice(toc.listStart, toc.listEnd);
    for (const item of body.matchAll(/<li\b[^>]*>/gi)) {
      const start = toc.listStart + (item.index ?? 0) + item[0].length;
      const tail = html.slice(start, toc.listEnd);
      const stop = tail.search(ITEM_LABEL_END);
      const end = start + (stop < 0 ? tail.length : stop);
      items.push({ start, end, label: html.slice(start, end) });
    }
    if (items.length === 0) continue;

    const targetTokens = targets.map((heading) => tokensOf(heading.text));
    const frequency = new Map<string, number>();
    for (const tokens of targetTokens) for (const token of tokens) frequency.set(token, (frequency.get(token) ?? 0) + 1);
    const weight = (token: string) => Math.log(1 + (targets.length + 1) / ((frequency.get(token) ?? 0) + 1));
    const topLevel = Math.min(...targets.map((heading) => heading.level));

    const scores = items.map((item) => {
      const itemText = normalize(textOf(item.label));
      const itemTokens = tokensOf(itemText);
      return targets.map((heading, index) => {
        if (normalize(heading.text) === itemText) return 2;
        const penalty = heading.level === topLevel ? 1 : heading.level === topLevel + 1 ? 0.85 : 0.7;
        return similarity(itemTokens, targetTokens[index], weight) * penalty;
      });
    });
    const pairs = alignInOrder(scores);

    // A list with exactly one item per top-level section, matched in step
    // wherever wording allowed: the leftover items are the same sections.
    const sections = targets.map((heading, index) => ({ heading, index })).filter(({ heading }) => heading.level === topLevel);
    if (sections.length === items.length && pairs.size >= items.length / 2) {
      const inStep = Array.from(pairs).every(([item, target]) => sections[item]?.index === target);
      if (inStep) sections.forEach((section, item) => pairs.set(item, section.index));
    }

    pairs.forEach((targetIndex, itemIndex) => {
      const item = items[itemIndex];
      if (/<a\b/i.test(item.label) || !textOf(item.label)) return;
      const href = `#${escapeAttr(targets[targetIndex].id)}`;
      const open = `<a href="${href}" class="tk-toc-link">`;
      const leading = item.label.match(/^\s*/)?.[0] ?? "";
      const trailing = item.label.match(/\s*$/)?.[0] ?? "";
      const inner = item.label.trim();
      const paragraph = inner.match(SINGLE_PARAGRAPH);
      const linked =
        paragraph && !/<p\b/i.test(paragraph[2])
          ? `<p${paragraph[1] ?? ""}>${open}${paragraph[2]}</a></p>`
          : `${open}${inner}</a>`;
      edits.push({ start: item.start, end: item.end, text: `${leading}${linked}${trailing}` });
    });

    const label = toc.titleId ? `aria-labelledby="${escapeAttr(toc.titleId)}"` : 'aria-label="Table of contents"';
    edits.push({ start: toc.listStart, end: toc.listStart, text: `<nav class="tk-toc" ${label}>` });
    edits.push({ start: toc.listEnd, end: toc.listEnd, text: "</nav>" });
  }

  let out = html;
  for (const edit of edits.sort((a, b) => b.start - a.start || b.end - a.end)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out;
}

const ACTIVE_SLACK = 8;

type TocEntry = { link: HTMLAnchorElement; target: HTMLElement };

// "#id" -> that element inside `root`, or null for "#" (the editor's
// placeholder link) and unknown ids. Looked up in `root` rather than the
// document: after a client-side navigation the article can still be detached
// when the effect first runs.
const elementForHash = (root: HTMLElement, hash: string): HTMLElement | null => {
  if (!hash.startsWith("#") || hash.length < 2) return null;
  let id = hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    // Keep the raw id.
  }
  return root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
};

const collectEntries = (root: HTMLElement): TocEntry[] =>
  Array.from(root.querySelectorAll<HTMLAnchorElement>(".tk-toc a.tk-toc-link"))
    .map((link) => ({ link, target: elementForHash(root, link.getAttribute("href") ?? "") }))
    .filter((entry): entry is TocEntry => !!entry.target)
    .sort((a, b) => (a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

/**
 * Wires the links linkContentToc made inside `root` (the element holding the
 * article HTML). Pass the rendered HTML so it re-runs when the article changes.
 * Active state is written straight to the DOM (aria-current), so scrolling
 * never re-renders the article.
 */
export function useContentToc(root: HTMLElement | null, html: string): void {
  useEffect(() => {
    if (!root || !html) return;

    let cached: TocEntry[] = [];
    const entries = () => {
      if (cached.length === 0 || !cached[0].link.isConnected) cached = collectEntries(root);
      return cached;
    };

    let active: HTMLAnchorElement | null = null;
    // Set by a click: that item stays active through the smooth scroll and
    // after it, even when the section sits too low on the page to reach the
    // top, until the reader scrolls, taps or types.
    let pinned: HTMLAnchorElement | null = null;

    const setActive = (link: HTMLAnchorElement | null) => {
      if (link === active) return;
      active?.removeAttribute("aria-current");
      link?.setAttribute("aria-current", "location");
      active = link;
    };

    const update = () => {
      if (pinned) return setActive(pinned);
      const list = entries();
      if (list.length === 0 || !root.isConnected) return;
      const line = (parseFloat(getComputedStyle(list[0].target).scrollMarginTop) || 0) + ACTIVE_SLACK;
      let current: HTMLAnchorElement | null = null;
      for (const entry of list) {
        if (entry.target.getBoundingClientRect().top <= line) current = entry.link;
      }
      // A short last section may never reach the line; at the end of the article it wins.
      const last = list[list.length - 1];
      const lastTop = last.target.getBoundingClientRect().top;
      if (current && root.getBoundingClientRect().bottom <= window.innerHeight + 4 && lastTop > line && lastTop < window.innerHeight) {
        current = last.link;
      }
      setActive(current);
    };

    const release = () => {
      if (!pinned) return;
      pinned = null;
      update();
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href^='#']");
      if (!link || !root.contains(link)) return;
      const target = elementForHash(root, link.getAttribute("href") ?? "");
      if (!target) return;
      event.preventDefault();
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      window.history.replaceState(window.history.state, "", `#${encodeURIComponent(target.id)}`);
      const list = entries();
      const entry = list.find((candidate) => candidate.link === link) ?? list.find((candidate) => candidate.target === target);
      if (entry) {
        pinned = entry.link;
        setActive(entry.link);
      }
    };

    // Landing on /exams/...#section: the article may arrive after the router
    // has already tried the hash, so scroll to it once it is on the page.
    let frame = 0;
    if (elementForHash(root, window.location.hash)) {
      frame = window.requestAnimationFrame(() => {
        const hashTarget = elementForHash(root, window.location.hash);
        if (!hashTarget || !root.isConnected) return;
        hashTarget.scrollIntoView({ block: "start" });
        const entry = entries().find((candidate) => candidate.target === hashTarget);
        if (entry) {
          pinned = entry.link;
          setActive(entry.link);
        }
      });
    }

    update();
    root.addEventListener("click", onClick);
    document.addEventListener("scroll", update, { capture: true, passive: true });
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("pointerdown", release, { passive: true });
    window.addEventListener("keydown", release);
    return () => {
      window.cancelAnimationFrame(frame);
      root.removeEventListener("click", onClick);
      document.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", update);
      window.removeEventListener("wheel", release);
      window.removeEventListener("pointerdown", release);
      window.removeEventListener("keydown", release);
      active?.removeAttribute("aria-current");
    };
  }, [root, html]);
}
