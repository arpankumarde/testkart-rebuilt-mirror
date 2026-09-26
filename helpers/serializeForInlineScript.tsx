/**
 * JSON.stringify for a value embedded in an inline <script> block.
 * JSON.stringify leaves "</script>" and "<!--" intact, so a value holding either
 * ends the script element early and whatever follows runs as markup. The escapes
 * below decode back to the same characters inside the JS literal; the line and
 * paragraph separators (U+2028, U+2029) are escaped for pre-ES2019 engines.
 */
export const serializeForInlineScript = (value: unknown): string =>
  (JSON.stringify(value) ?? "null")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\p{Zl}/gu, "\\u2028")
    .replace(/\p{Zp}/gu, "\\u2029");