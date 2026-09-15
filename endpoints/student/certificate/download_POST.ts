import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, InputType } from "./download_POST.schema";
import { generateCertificatePdf } from "../../../helpers/generateCertificatePdf";
import superjson from "superjson";
import { CertificateData } from "../../../helpers/certificateTypes";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(
        superjson.stringify({ error: "Only students can download certificates." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input: InputType = schema.parse(json);

    const certificate = await db
      .selectFrom("certificates")
      .selectAll()
      .where("id", "=", input.certificateId)
      .executeTakeFirst();

    if (!certificate) {
      return new Response(
        superjson.stringify({ error: "Certificate not found." }),
        { status: 404 }
      );
    }

    if (certificate.studentId !== user.id) {
      return new Response(
        superjson.stringify({ error: "You are not authorized to download this certificate." }),
        { status: 403 }
      );
    }

    const certificateData = certificate.certificateData as unknown as CertificateData;
    const pdfDoc = await generateCertificatePdf(certificateData);

    const pdfBuffer = Buffer.from(await pdfDoc.arrayBuffer());

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${certificate.certificateNumber}.pdf"`,
      },
    });

  } catch (error) {
    console.error("Error downloading certificate:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to download certificate.", details: errorMessage }),
      { status: 500 }
    );
  }
}