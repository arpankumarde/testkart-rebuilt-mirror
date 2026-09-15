import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, InputType } from "./generate_POST.schema";
import { generateCertificatePdf } from "../../../helpers/generateCertificatePdf";
import superjson from "superjson";
import { CertificateData } from "../../../helpers/certificateTypes";
import { sql } from "kysely";
import { emailTemplatesExtra } from "../../../helpers/emailTemplatesExtra";
import { sendEmail } from "../../../helpers/sendEmail";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(
        superjson.stringify({ error: "Only students can generate certificates." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input: InputType = schema.parse(json);

    // Check if certificate already exists
    const existingCertificate = await db
      .selectFrom("certificates")
      .where("studentId", "=", user.id)
      .where("certificateType", "=", input.certificateType)
      .$if(input.certificateType === "course_completion", (eb) =>
        eb.where("courseId", "=", input.itemId)
      )
      .$if(input.certificateType === "test_completion", (eb) =>
        eb.where("testItemId", "=", input.itemId)
      )
      .select("id")
      .executeTakeFirst();

    if (existingCertificate) {
      return new Response(
        superjson.stringify({ error: "Certificate has already been generated." }),
        { status: 400 }
      );
    }

    let certificateData: Omit<CertificateData, "certificateNumber">;
    const completionDate = new Date();
    const completionDateISO = completionDate.toISOString();

    if (input.certificateType === "course_completion") {
      const enrollment = await db
        .selectFrom("courseEnrollments")
        .innerJoin("courses", "courses.id", "courseEnrollments.courseId")
        .innerJoin("users", "users.id", "courses.teacherId")
        .where("courseEnrollments.studentId", "=", user.id)
        .where("courseEnrollments.courseId", "=", input.itemId)
        .select([
          "courseEnrollments.completionPercentage",
          "courses.title",
          "users.displayName as teacherName",
        ])
        .executeTakeFirst();

      if (!enrollment || enrollment.completionPercentage < 100) {
        return new Response(
          superjson.stringify({ error: "Course not completed." }),
          { status: 400 }
        );
      }
      certificateData = {
        studentName: user.displayName,
        itemName: enrollment.title,
        teacherName: enrollment.teacherName,
        completionDate: completionDateISO,
        type: "course_completion",
      };
    } else { // test_completion
      const bestAttempt = await db
        .selectFrom("testAttempts")
        .where("studentId", "=", user.id)
        .where("testId", "=", input.itemId)
        .where("completedAt", "is not", null)
        .orderBy("score", "desc")
        .select("score")
        .executeTakeFirst();

      if (!bestAttempt || bestAttempt.score === null) {
        return new Response(
          superjson.stringify({ error: "Test not completed or no score available." }),
          { status: 400 }
        );
      }

      const testInfo = await db
        .selectFrom("mockTestItems")
        .innerJoin("mockTests", "mockTests.id", "mockTestItems.packageId")
        .innerJoin("users", "users.id", "mockTests.teacherId")
        .where("mockTestItems.id", "=", input.itemId)
        .select([
          "mockTestItems.title",
          "users.displayName as teacherName",
        ])
        .executeTakeFirst();

      if (!testInfo) {
        return new Response(
          superjson.stringify({ error: "Test not found." }),
          { status: 404 }
        );
      }

      certificateData = {
        studentName: user.displayName,
        itemName: testInfo.title,
        teacherName: testInfo.teacherName,
        completionDate: completionDateISO,
        score: parseFloat(bestAttempt.score as string),
        type: "test_completion",
      };
    }

    const newCertificate = await db
      .insertInto("certificates")
      .values({
        studentId: user.id,
        certificateType: input.certificateType,
        courseId: input.certificateType === "course_completion" ? input.itemId : null,
        testItemId: input.certificateType === "test_completion" ? input.itemId : null,
        completionDate: completionDate,
        issuedAt: new Date(),
        scorePercentage: certificateData.type === 'test_completion' ? certificateData.score : null,
        certificateNumber: "TEMP", // Placeholder
        certificateData: JSON.parse(JSON.stringify(certificateData)),
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const certificateNumber = `CERT-${completionDate.getFullYear()}-${newCertificate.id.toString().padStart(6, "0")}`;

    await db
      .updateTable("certificates")
      .set({ 
        certificateNumber,
        certificateData: JSON.parse(JSON.stringify({ ...certificateData, certificateNumber })),
      })
      .where("id", "=", newCertificate.id)
      .execute();

    const finalCertificateData = { ...certificateData, certificateNumber } as CertificateData;
    const pdfDoc = await generateCertificatePdf(finalCertificateData);
    
    const pdfBuffer = Buffer.from(await pdfDoc.arrayBuffer());

    try {
      const fullUser = await db.selectFrom("users")
        .select("email")
        .where("id", "=", user.id)
        .executeTakeFirst();
      
      if (fullUser?.email) {
        const template = emailTemplatesExtra.certificateGenerated(
          user.displayName,
          finalCertificateData.itemName,
          certificateNumber
        );
        await sendEmail({
          to: fullUser.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
      }
    } catch (err) {
      console.error("[Certificate Generate] Failed to send certificate email:", err);
    }

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${certificateNumber}.pdf"`,
      },
    });

  } catch (error) {
    console.error("Error generating certificate:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to generate certificate.", details: errorMessage }),
      { status: 500 }
    );
  }
}