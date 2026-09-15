import { schema, OutputType } from "./add_POST.schema";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import superjson from "superjson";
import { Insertable } from "kysely";
import { StudentBankDetails } from "../../../helpers/schema";
import { sendAdminNotification } from "../../../helpers/sendAdminNotification";
import { uploadToR2, getPublicUrl } from "../../../helpers/r2Client";
import { nanoid } from "nanoid";
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
      const key = `kyc/students/${user.id}/pan-${nanoid(8)}.${ext}`;
      await uploadToR2(key, buffer, contentType);
      panCardImageUrl = getPublicUrl(key);
    }

    const newDetails: Insertable<StudentBankDetails> = {
      ...validatedInput,
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
          panCardImageBase64: panCardImageUrl,
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

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("Error adding/updating student bank details:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400 }
    );
  }
}