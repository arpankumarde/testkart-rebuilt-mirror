import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TeacherInquiries, InquiryStatusArrayValues } from "../../helpers/schema";

export const schema = z.object({
  status: z.enum(InquiryStatusArrayValues).optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  inquiries: Selectable<TeacherInquiries>[];
};

export const getAdminInquiries = async (
  params: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams();
  if (params.status) {
    queryParams.set("status", params.status);
  }

  const result = await fetch(`/_api/admin/inquiries?${queryParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};