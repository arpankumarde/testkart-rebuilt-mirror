import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  teacherId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type TeacherOrderItem = {
  orderItemId: number;
  orderId: number;
  orderDate: Date | null;
  productName: string;
  productType: "mock_test" | "course" | "digital_product" | "unknown";
  priceAtPurchase: number;
  discountAmount: number;
  currentPlatformFee: number;
  studentName: string;
};

export type OutputType = {
  orderItems: TeacherOrderItem[];
};

export const getAdminTeacherOrders = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  // Validate input parameters
  const validatedParams = schema.parse(params);

  const queryParams = new URLSearchParams({
    teacherId: validatedParams.teacherId.toString(),
  });

  const result = await fetch(`/_api/admin/subscriptions/teacher-orders?${queryParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};