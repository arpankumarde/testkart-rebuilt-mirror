import { db } from "../../helpers/db";
import { schema } from "./public-download_POST.schema";
import superjson from "superjson";
import { generateCertificatePdf } from "../../helpers/generateCertificatePdf";
import { CertificateData } from "../../helpers/certificateTypes";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { certificateId } = schema.parse(json);

    const certificate = await db
      .selectFrom("certificates")
      .selectAll()
      .where("certificateNumber", "=", certificateId)
      .executeTakeFirst();

    if (!certificate) {
      return new Response(
        superjson.stringify({ error: "Certificate not found." }),
        { status: 404 }
      );
    }

    const certificateData = certificate.certificateData as unknown as CertificateData;

    if (!certificateData || !certificateData.studentName || !certificateData.itemName) {
        console.error("Incomplete certificate data for public download", { certificateId });
        return new Response(
            superjson.stringify({ error: "Certificate data is incomplete and cannot be downloaded." }),
            { status: 500 }
        );
    }

    const pdfBlob = await generateCertificatePdf(certificateData);
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${certificate.certificateNumber}.pdf"`,
      },
    });

  } catch (error) {
    console.error("Error downloading public certificate:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to download certificate.", details: errorMessage }),
      { status: 500 }
    );
  }
}