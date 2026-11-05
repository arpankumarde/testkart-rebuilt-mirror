import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "../helpers/useAuth";
import { postCartAdd } from "../endpoints/cart/add_POST.schema";
import { CART_QUERY_KEY } from "../helpers/useCartQuery";
import { readGuestCart, removeGuestCartItems } from "../helpers/guestCart";
import { trackFunnelEvent } from "../helpers/trackFunnelEvent";

/** After a student signs in, moves the items they picked while signed out into their cart. Renders nothing. */
export const GuestCartSync = () => {
  const { authState } = useAuth();
  const queryClient = useQueryClient();
  const running = useRef(false);
  const userId = authState.type === "authenticated" ? authState.user.id : null;
  const isStudent = authState.type === "authenticated" && authState.user.role === "student";

  useEffect(() => {
    if (!isStudent || running.current) return;
    const items = readGuestCart();
    if (items.length === 0) return;
    running.current = true;

    (async () => {
      let added = 0;
      for (const item of items) {
        try {
          await postCartAdd(
            item.kind === "test" ? { mockTestId: item.id } : item.kind === "course" ? { courseId: item.id } : { digitalProductId: item.id }
          );
          added += 1;
        } catch {
          // Already in the cart, already owned, or no longer on sale: nothing to keep.
        }
      }
      removeGuestCartItems(items);
      if (added > 0) {
        trackFunnelEvent("guest_cart_merged", undefined, { added, kept: items.length });
        await queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
        toast.success(added === 1 ? "The item you picked is in your cart." : `The ${added} items you picked are in your cart.`);
      }
      running.current = false;
    })();
  }, [isStudent, userId, queryClient]);

  return null;
};
