import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCartItems, CartItem } from "../endpoints/cart/items_GET.schema";
import { postCartAdd } from "../endpoints/cart/add_POST.schema";
import { postCartRemove } from "../endpoints/cart/remove_POST.schema";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { useAuth } from "./useAuth";

export const CART_QUERY_KEY = ["cart", "items"];

export const useCartItemsQuery = () => {
  const { authState } = useAuth();
  
  return useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: () => getCartItems(),
    enabled: authState.type === "authenticated",
    staleTime: 15 * 60 * 1000, // 15 minutes - cart changes infrequently during a session
  });
};

export const useAddToCartMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      mockTestId?: number;
      courseId?: number;
      digitalProductId?: number;
    }) => postCartAdd(input),
    onSuccess: (data, variables) => {
      toast.success(data.message || "Item added to cart!");
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to add item to cart.");
    },
  });
};

export const useRemoveFromCartMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postCartRemove,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: CART_QUERY_KEY });
      const previousCartData = queryClient.getQueryData<{ items: CartItem[] }>(CART_QUERY_KEY);
      
      if (previousCartData) {
        queryClient.setQueryData<{ items: CartItem[] }>(CART_QUERY_KEY, {
          ...previousCartData,
          items: previousCartData.items.filter(
            (item) => item.cartItemId !== variables.cartItemId
          ),
        });
      }
      
      return { previousCartData };
    },
    onError: (err, variables, context) => {
      if (context?.previousCartData) {
        queryClient.setQueryData(CART_QUERY_KEY, context.previousCartData);
      }
      toast.error("Failed to remove item. Please try again.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
    onSuccess: () => {
        toast.success("Item removed from cart.");
    }
  });
};