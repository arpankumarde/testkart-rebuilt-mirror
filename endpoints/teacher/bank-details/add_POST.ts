import { schema, OutputType } from "./add_POST.schema";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import superjson from "superjson";
import { Insertable } from "kysely";
import { TeacherBankDetails } from "../../../helpers/schema";
import { sendAdminNotification } from "../../../helpers/sendAdminNotification";
import { getTeacherAvailableBalance } from "../../../helpers/getTeacherAvailableBalance";
import { uploadToR2, getPublicUrl } from "../../../helpers/r2Client";
import { nanoid } from "nanoid";

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

    let panCardImageUrl = validatedInput.panCardImageBase64;
    if (panCardImageUrl.startsWith('data:')) {
      const matches = panCardImageUrl.match(/^data:(image\/[a-z]+);base64,(.*)$/);
      if (!matches || matches.length !== 3) {
        return new Response(superjson.stringify({ error: "Invalid image data format." }), { status: 400 });
      }
      const contentType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const ext = contentType.split('/')[1] || 'jpg';
      const key = `kyc/teachers/${effectiveTeacherId}/pan-${nanoid(8)}.${ext}`;
      await uploadToR2(key, buffer, contentType);
      panCardImageUrl = getPublicUrl(key);
    }

    const newDetails: Insertable<TeacherBankDetails> = {
      ...validatedInput,
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
          panCardImageBase64: panCardImageUrl,
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

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("Error adding/updating teacher bank details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}