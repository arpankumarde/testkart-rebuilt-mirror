/**
 * Items a signed-out visitor tried to add to the cart. They are kept in this
 * browser and moved into the real cart right after sign-in (GuestCartSync), so
 * the login wall no longer loses what they picked. The server cart and its
 * endpoints are unchanged, so the mobile app is not affected.
 */

export type GuestCartKind = "test" | "course" | "digitalProduct";
export type GuestCartItem = { kind: GuestCartKind; id: number; addedAt: number };

const KEY = "tk_guest_cart";
const MAX_ITEMS = 20;
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;

export function readGuestCart(): GuestCartItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    const now = Date.now();
    return raw.filter(
      (i): i is GuestCartItem =>
        !!i &&
        (i.kind === "test" || i.kind === "course" || i.kind === "digitalProduct") &&
        Number.isInteger(i.id) &&
        i.id > 0 &&
        typeof i.addedAt === "number" &&
        now - i.addedAt < MAX_AGE_MS
    );
  } catch {
    return [];
  }
}

function writeGuestCart(items: GuestCartItem[]) {
  try {
    if (items.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
  } catch {
    // Storage blocked: the visitor simply adds the item again after sign-in.
  }
}

/**
 * Keeps a paid item for after sign-in. Returns false for kinds the cart does
 * not take (bundles, live tests), so the caller keeps its old behaviour.
 */
export function keepForCheckout(kind: string, id: number): boolean {
  if (kind !== "test" && kind !== "course" && kind !== "digitalProduct") return false;
  const items = readGuestCart().filter((i) => !(i.kind === kind && i.id === id));
  writeGuestCart([...items, { kind, id, addedAt: Date.now() }]);
  return true;
}

export function removeGuestCartItems(done: GuestCartItem[]) {
  const left = readGuestCart().filter((i) => !done.some((d) => d.kind === i.kind && d.id === i.id));
  writeGuestCart(left);
}

export const guestCartLoginPath = "/login?redirectTo=%2Fcart";
