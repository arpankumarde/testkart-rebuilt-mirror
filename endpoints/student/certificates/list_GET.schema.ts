import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Certificates, CertificateType } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type CertificateListItem = Pick<
  Selectable<Certificates>,
  | "id"
  | "certificateNumber"
  | "completionDate"
  | "issuedAt"
  | "scorePercentage"
> & {
  certificateType: CertificateType;
  itemName: string;
};

export type OutputType = {
  certificates: CertificateListItem[];
};

export const getStudentCertificatesList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/student/certificates/list`, {
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