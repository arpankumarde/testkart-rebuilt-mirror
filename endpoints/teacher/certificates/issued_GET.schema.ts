import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Certificates, Users } from "../../../helpers/schema";

export const schema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type InputType = z.infer<typeof schema>;

export type IssuedCertificate = Selectable<Certificates> & {
  studentName: Selectable<Users>["displayName"];
  itemName: string;
};

export type OutputType = {
  certificates: IssuedCertificate[];
  total: number;
};

export const getTeacherCertificatesIssued = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams({
    page: params.page?.toString() ?? "1",
    limit: params.limit?.toString() ?? "10",
  });

  const result = await fetch(
    `/_api/teacher/certificates/issued?${queryParams.toString()}`,
    {
      method: "GET",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    }
  );

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};