import { randomBytes } from "crypto";
import { db } from "./db";
import { safeRedirectPath } from "./messageLinkRules";

/**
 * A tracked link for an autopilot message: a short code in message_links that
 * endpoints/go_GET logs and redirects. Every link in an autopilot email,
 * WhatsApp or push must come from here, or its clicks are invisible.
 * Server-only.
 */

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SITE_URL = "https://testkart.in";

function newCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return code;
}

export async function createMessageLink(messageId: string | number | null, targetPath: string): Promise<string> {
  const path = safeRedirectPath(targetPath);
  if (!path) throw new Error(`Refusing to create a message link to ${targetPath}`);
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode();
    const inserted = await db
      .insertInto("messageLinks")
      .values({ code, messageId: messageId === null ? null : String(messageId), targetPath: path })
      .onConflict((oc) => oc.column("code").doNothing())
      .returning("code")
      .executeTakeFirst();
    if (inserted) return `${SITE_URL}/_api/go?c=${code}`;
  }
  throw new Error("Could not allocate a message link code");
}