import { schema, OutputType } from "./add_POST.schema";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import superjson from "superjson";
import { Insertable } from "kysely";
import { StudentBankDetails } from "../../../helpers/schema";
import { sendAdminNotification } from "../../../helpers/sendAdminNotification";
import { kycImageUrl, resolveKycImage } from "../../../helpers/kycImage";
import { getStudentAvailableBalance } from "../../../helpers/getStudentAvailableBalance";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "student") {
      return new Response(
        superjson.stringify({ error: "Only students can add bank details." }),
        { status: 403 }
      );
    }

    const balanceData = await getStudentAvailableBalance(user.id);
    if (balanceData.availableBalance < 50) {
      return new Response(
        superjson.stringify({ error: "You need at least ₹50 in prize money before you can add bank details." }),
        { status: 400 }
      );
    }

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    const existing = await db
      .selectFrom("studentBankDetails")
      .select("panCardImageBase64")
      .where("studentId", "=", user.id)
      .executeTakeFirst();

    const panCardImage = await resolveKycImage(
      "student",
      user.id,
      validatedInput.panCardImageBase64,
      existing?.panCardImageBase64
    );
    if (!panCardImage) {
      return new Response(
        superjson.stringify({ error: "The PAN card image could not be read. Please upload it again." }),
        { status: 400 }
      );
    }

    const newDetails: Insertable<StudentBankDetails> = {
      ...validatedInput,
      panCardImageBase64: panCardImage,
      studentId: user.id,
      verificationStatus: "pending",
      rejectionReason: null,
    };

    const result = await db
      .insertInto("studentBankDetails")
      .values(newDetails)
      .onConflict((oc) =>
        oc.column("studentId").doUpdateSet({
          ...validatedInput,
          panCardImageBase64: panCardImage,
          verificationStatus: "pending",
          rejectionReason: null,
          updatedAt: new Date(),
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    sendAdminNotification("student_verification", {
      userName: user.displayName,
      userEmail: user.email,
      userId: user.id,
    });

    const output: OutputType = { ...result, panCardImageBase64: await kycImageUrl(result.panCardImageBase64) };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error adding/updating student bank details:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400 }
    );
  }
}