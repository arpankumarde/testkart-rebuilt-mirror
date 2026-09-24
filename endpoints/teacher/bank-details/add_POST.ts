import { schema, OutputType } from "./add_POST.schema";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import superjson from "superjson";
import { Insertable } from "kysely";
import { TeacherBankDetails } from "../../../helpers/schema";
import { sendAdminNotification } from "../../../helpers/sendAdminNotification";
import { getTeacherAvailableBalance } from "../../../helpers/getTeacherAvailableBalance";
import { kycImageUrl, resolveKycImage } from "../../../helpers/kycImage";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    // Block managers from owner-only features
    if (teacherRole === 'manager') {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    if (user.role !== "teacher") {
      return new Response(
        superjson.stringify({ error: "Only teachers can add bank details." }),
        { status: 403 }
      );
    }

    // Check if teacher has at least ₹100 in available balance
    const balanceData = await getTeacherAvailableBalance(effectiveTeacherId);
    if (balanceData.availableBalance < 100) {
      return new Response(
        superjson.stringify({ error: "You need at least ₹100 in earnings before you can add bank details." }),
        { status: 400 }
      );
    }

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    const existing = await db
      .selectFrom("teacherBankDetails")
      .select("panCardImageBase64")
      .where("teacherId", "=", effectiveTeacherId)
      .executeTakeFirst();

    const panCardImage = await resolveKycImage(
      "teacher",
      effectiveTeacherId,
      validatedInput.panCardImageBase64,
      existing?.panCardImageBase64
    );
    if (!panCardImage) {
      return new Response(
        superjson.stringify({ error: "The PAN card image could not be read. Please upload it again." }),
        { status: 400 }
      );
    }

    const newDetails: Insertable<TeacherBankDetails> = {
      ...validatedInput,
      panCardImageBase64: panCardImage,
      teacherId: effectiveTeacherId,
      verificationStatus: "pending",
      rejectionReason: null,
    };

    const result = await db
      .insertInto("teacherBankDetails")
      .values(newDetails)
      .onConflict((oc) =>
        oc.column("teacherId").doUpdateSet({
          ...validatedInput,
          panCardImageBase64: panCardImage,
          verificationStatus: "pending", // Reset on update
          rejectionReason: null, // Clear on update
          updatedAt: new Date(),
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    sendAdminNotification("teacher_verification", {
      userName: user.displayName,
      userEmail: user.email,
      userId: user.id,
    });

    const output: OutputType = { ...result, panCardImageBase64: await kycImageUrl(result.panCardImageBase64) };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error adding/updating teacher bank details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}