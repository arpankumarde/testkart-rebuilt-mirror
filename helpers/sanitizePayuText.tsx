// PayU hashes these fields with "|" as the delimiter. testkart-app builds released before its payuForm fix
// also write live test PayU fields into double-quoted HTML attributes unescaped, so a quote would break out.
export const sanitizePayuText = (value: string): string =>
  value.replace(/\|/g, " ").replace(/"/g, "'").replace(/[<>]/g, "");