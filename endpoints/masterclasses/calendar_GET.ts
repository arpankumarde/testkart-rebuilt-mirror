import { db } from "../../helpers/db";

const BASE_URL = "https://testkart.in";

const pad = (n: number): string => String(n).padStart(2, "0");

const toUtcStamp = (date: Date): string =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours()
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

// RFC 5545 TEXT escaping: backslash, semicolon, comma, then real newlines as
// the literal two-character sequence \n. Order matters - the backslash
// replacement has to run first or it would double-escape the ones added by
// the other rules.
const escapeIcsText = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Folds any line over 75 octets onto continuation lines starting with a
// space, per RFC 5545 - most calendar apps are forgiving about this, but
// Outlook's desktop client is not.
const foldIcsLine = (line: string): string => {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75));
    rest = " " + rest.slice(75);
  }
  chunks.push(rest);
  return chunks.join("\r\n");
};

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug") ?? "";
    if (!slug) {
      return new Response("Missing slug.", { status: 400 });
    }

    const m = await db.selectFrom("masterclasses").selectAll().where("slug", "=", slug).executeTakeFirst();
    if (!m || m.status === "draft") {
      return new Response("This masterclass could not be found.", { status: 404 });
    }

    const start = new Date(m.startTime);
    const end = new Date(start.getTime() + (m.durationMinutes ?? 60) * 60 * 1000);
    const pageUrl = `${BASE_URL}/masterclass/${m.slug}`;
    const description = [
      m.subtitle || "A free live masterclass for teachers, hosted on Testkart.",
      "",
      `Details and join link: ${pageUrl}`,
    ].join("\n");

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Testkart//Masterclass//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:masterclass-${m.id}@testkart.in`,
      `DTSTAMP:${toUtcStamp(new Date())}`,
      `DTSTART:${toUtcStamp(start)}`,
      `DTEND:${toUtcStamp(end)}`,
      `SUMMARY:${escapeIcsText(m.title)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `LOCATION:${escapeIcsText(pageUrl)}`,
      `URL:${pageUrl}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(m.title)} starts in 30 minutes`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    const icsContent = lines.map(foldIcsLine).join("\r\n") + "\r\n";
    const filename = `${m.slug}.ics`;

    return new Response(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[masterclasses/calendar] Failed:", error);
    return new Response("Could not generate the calendar file.", { status: 500 });
  }
}
