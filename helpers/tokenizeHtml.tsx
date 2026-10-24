export type HtmlTokenKind = "tag" | "attribute" | "value" | "keyword" | "comment";
export type HtmlToken = { from: number; to: number; kind: HtmlTokenKind };

const MARKUP =
  /<!--[\s\S]*?(?:-->|$)|<!doctype[^>]*>?|(<(style|script)\b(?:"[^"]*"|'[^']*'|[^'">])*>)([\s\S]*?)(<\/\2\s*>|$)|<\/?[a-z][^\s/>]*(?:"[^"]*"|'[^']*'|[^'">])*>?|&#?\w+;/gi;
const TAG_NAME = /^<\/?[^\s/>]*/;
const ATTRIBUTE = /([^\s=/>"']+)(?:\s*=\s*("[^"]*"?|'[^']*'?|[^\s>]+))?/g;
const CSS = /\/\*[\s\S]*?(?:\*\/|$)|(@?[^{};]+)(?=\{)|([\w-]+)(\s*:\s*)([^;{}]*)/g;
const SCRIPT =
  /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\[\s\S])*`?|\b(?:var|let|const|function|return|if|else|for|while|new|typeof|this|true|false|null)\b/g;

function tokenizeTag(tag: string, offset: number, tokens: HtmlToken[]) {
  const name = TAG_NAME.exec(tag)?.[0] ?? "";
  tokens.push({ from: offset, to: offset + name.length, kind: "tag" });
  const attributes = tag.endsWith(">") ? tag.slice(0, -1) : tag;
  ATTRIBUTE.lastIndex = name.length;
  let match: RegExpExecArray | null;
  while ((match = ATTRIBUTE.exec(attributes))) {
    const start = offset + match.index;
    tokens.push({ from: start, to: start + match[1].length, kind: "attribute" });
    if (match[2]) {
      const end = start + match[0].length;
      tokens.push({ from: end - match[2].length, to: end, kind: "value" });
    }
  }
  if (tag.endsWith(">")) tokens.push({ from: offset + tag.length - 1, to: offset + tag.length, kind: "tag" });
}

function tokenizeCss(css: string, offset: number, tokens: HtmlToken[]) {
  CSS.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CSS.exec(css))) {
    const start = offset + match.index;
    if (match[1] !== undefined) {
      const selectorStart = start + match[1].length - match[1].trimStart().length;
      tokens.push({ from: selectorStart, to: start + match[1].trimEnd().length, kind: "keyword" });
    } else if (match[2] !== undefined) {
      const valueStart = start + match[2].length + match[3].length;
      tokens.push({ from: start, to: start + match[2].length, kind: "attribute" });
      tokens.push({ from: valueStart, to: valueStart + match[4].trimEnd().length, kind: "value" });
    } else {
      tokens.push({ from: start, to: start + match[0].length, kind: "comment" });
    }
  }
}

function tokenizeScript(script: string, offset: number, tokens: HtmlToken[]) {
  SCRIPT.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SCRIPT.exec(script))) {
    const text = match[0];
    const kind: HtmlTokenKind = text.startsWith("/") ? "comment" : /^["'`]/.test(text) ? "value" : "keyword";
    tokens.push({ from: offset + match.index, to: offset + match.index + text.length, kind });
  }
}

/**
 * Colour tokens for the HTML code editor, in document order. This is display
 * only and is not used for sanitizing. Sorted, non-overlapping and never throwing
 * on half-typed markup, since it runs on every keystroke.
 */
export function tokenizeHtml(source: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  MARKUP.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MARKUP.exec(source))) {
    const [text, blockOpen, blockTag, blockBody, blockClose] = match;
    const start = match.index;
    if (text.length === 0) {
      MARKUP.lastIndex += 1;
    } else if (blockOpen !== undefined) {
      tokenizeTag(blockOpen, start, tokens);
      const tokenizeBody = blockTag.toLowerCase() === "style" ? tokenizeCss : tokenizeScript;
      tokenizeBody(blockBody, start + blockOpen.length, tokens);
      if (blockClose) tokenizeTag(blockClose, start + blockOpen.length + blockBody.length, tokens);
    } else if (text.startsWith("<!--")) {
      tokens.push({ from: start, to: start + text.length, kind: "comment" });
    } else if (text.startsWith("&")) {
      tokens.push({ from: start, to: start + text.length, kind: "keyword" });
    } else if (/^<!/.test(text)) {
      tokens.push({ from: start, to: start + text.length, kind: "tag" });
    } else {
      tokenizeTag(text, start, tokens);
    }
  }
  return tokens.filter((token) => token.to > token.from);
}