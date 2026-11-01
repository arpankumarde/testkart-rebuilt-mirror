/** Minimal RFC 4180 CSV for the calendar's import and export: quoted fields, embedded commas, quotes and newlines. */

export function gecCsvParse(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

const escape = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function gecCsvStringify(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
}

/** One row per event; a record with no events gets one row with the event columns empty. */
export const GEC_CSV_HEADER = [
  "exam_slug",
  "record_type",
  "category",
  "name",
  "table_name",
  "short_name",
  "conducting_body",
  "testkart_exam_slug",
  "news_post_slug",
  "notice_number",
  "posts_description",
  "vacancies",
  "post_name",
  "official_url",
  "notification_url",
  "apply_url",
  "status_override",
  "status_label",
  "keywords",
  "hidden",
  "verification",
  "source_note",
  "review_note",
  "event_id",
  "event_type",
  "stage",
  "mode",
  "start_date",
  "end_date",
  "date_status",
  "date_label",
  "event_status_override",
  "listing_override",
  "concluded_override",
  "watch_next",
  "result_status",
  "result_url",
  "source_url",
  "event_notes",
] as const;
