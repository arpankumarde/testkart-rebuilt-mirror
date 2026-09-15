import { z } from "zod";
import superjson from "superjson";
import { CertificateType } from "../../helpers/schema";

export const schema = z.object({
  certificateId: z.string(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  id: number;
  certificateNumber: string;
  studentName: string;
  itemName: string;
  certificateType: CertificateType;
  completionDate: Date;
  scorePercentage: string | null;
  issuedBy: string; // Teacher's display name or academy name
};

export const getCertificatePublic = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams(params);
  const result = await fetch(
    `/_api/certificate/public?${queryParams.toString()}`,
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
    if (result.status === 404) {
      throw new Error("404: Certificate not found");
    }
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};