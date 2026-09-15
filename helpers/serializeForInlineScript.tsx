/**
 * JSON.stringify for a string embedded in an inline <script> block.
 * JSON.stringify leaves "</script>" and "<!--" intact, so a value holding either
 * ends the script element early and whatever follows runs as markup. The escapes
 * below decode back to the same characters inside the JS string literal.
 */
export const serializeForInlineScript = (value: string): string =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
