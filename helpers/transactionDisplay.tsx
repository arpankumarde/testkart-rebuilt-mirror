import type { AdminOrderClient } from "../endpoints/admin/orders/search_POST.schema";

/*
 * Plain-text labels for the admin Transactions table, detail sheet and CSV.
 * Missing values read as "Not captured" rather than a guess.
 */

export const NOT_CAPTURED_LABEL = "Not captured";

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" ");

export function osLabel(client: AdminOrderClient | null): string {
  if (!client?.osName) return NOT_CAPTURED_LABEL;
  return join(client.osName, client.osVersion);
}

export function browserLabel(client: AdminOrderClient | null): string {
  if (!client) return NOT_CAPTURED_LABEL;
  if (client.source === "android_app" || client.source === "ios_app") return "Testkart app";
  if (!client.browserName) return NOT_CAPTURED_LABEL;
  return join(client.browserName, client.browserVersion);
}

/** "Samsung SM-X110", "iPhone", "Windows PC"; the hardware only, never inferred past what was captured. */
export function deviceLabel(client: AdminOrderClient | null): string {
  if (!client) return NOT_CAPTURED_LABEL;
  const { deviceBrand: brand, deviceModel: model } = client;
  if (model) {
    if (brand === "Apple" || !brand || model.toLowerCase().startsWith(brand.toLowerCase())) return model;
    return `${brand} ${model}`;
  }
  if (brand) {
    const kind = client.deviceType === "tablet" ? "tablet" : client.deviceType === "mobile" ? "phone" : "device";
    return `${brand} ${kind}`;
  }
  switch (client.osName) {
    case "Windows":
      return "Windows PC";
    case "macOS":
      return "Mac";
    case "Linux":
      return "Linux PC";
    case "ChromeOS":
      return "Chromebook";
    case "Android":
      return client.deviceType === "tablet" ? "Android tablet" : "Android phone";
    case "iOS":
      return "iPhone";
    case "iPadOS":
      return "iPad";
    default:
      return client.deviceType === "unknown" ? "Unknown device" : `${client.deviceType[0].toUpperCase()}${client.deviceType.slice(1)}`;
  }
}

/** One compact line for the table: "Samsung SM-X110, Chrome 156" or "Xiaomi phone, app 4.13.0". */
export function deviceSummary(client: AdminOrderClient | null): string {
  if (!client) return NOT_CAPTURED_LABEL;
  const isApp = client.source === "android_app" || client.source === "ios_app";
  const second = isApp
    ? client.appVersion
      ? `app ${client.appVersion.split(" ")[0]}`
      : osLabel(client)
    : client.browserName
      ? join(client.browserName, client.browserVersion)
      : null;
  return second ? `${deviceLabel(client)}, ${second}` : deviceLabel(client);
}

export const ITEM_TYPE_LABELS: Record<string, string> = {
  test: "Mock test",
  live_test: "Live test",
  course: "Course",
  product: "Study notes",
  bundle: "Bundle",
};

export const formatDay = (date: Date): string =>
  new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export const formatTime = (date: Date): string =>
  new Date(date).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export const formatDateTime = (date: Date | null): string =>
  date ? `${formatDay(date)}, ${formatTime(date)}` : "Not recorded";

/** "2026-11-09 9:37 pm" in the admin's local time, for CSV exports. */
export const toCsvDateTime = (date: Date | null): string => {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${formatTime(d)}`;
};

export const formatInr = (amount: number): string =>
  `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;