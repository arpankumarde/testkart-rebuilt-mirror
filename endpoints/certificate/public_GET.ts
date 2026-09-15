import { db } from "../../helpers/db";
import { schema, OutputType } from "./public_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const certificateId = url.searchParams.get("certificateId");

    const validation = schema.safeParse({ certificateId });
    if (!validation.success) {
      return new Response(
        superjson.stringify({ error: "Invalid certificate ID format." }),
        { status: 400 }
      );
    }

    const certNumber = validation.data.certificateId;

    const certificate = await db
      .selectFrom("certificates")
      .innerJoin("users as student", "student.id", "certificates.studentId")
      .leftJoin("courses", "courses.id", "certificates.courseId")
      .leftJoin("mockTestItems", "mockTestItems.id", "certificates.testItemId")
      .leftJoin("users as courseTeacher", "courseTeacher.id", "courses.teacherId")
      .leftJoin("mockTests", "mockTests.id", "mockTestItems.packageId")
      .leftJoin("users as testTeacher", "testTeacher.id", "mockTests.teacherId")
      .select([
        "certificates.id",
        "certificates.certificateNumber",
        "student.displayName as studentName",
        "certificates.certificateType",
        "certificates.completionDate",
        "certificates.scorePercentage",
        "courses.title as courseName",
        "mockTestItems.title as testItemName",
        "courseTeacher.displayName as courseTeacherName",
        "courseTeacher.academyName as courseTeacherAcademy",
        "testTeacher.displayName as testTeacherName",
        "testTeacher.academyName as testTeacherAcademy",
      ])
      .where("certificates.certificateNumber", "=", certNumber)
      .executeTakeFirst();

    if (!certificate) {
      return new Response(
        superjson.stringify({ error: "Certificate not found." }),
        { status: 404 }
      );
    }

    const itemName = certificate.courseName || certificate.testItemName || "Completed Item";
    const teacherName = certificate.courseTeacherName || certificate.testTeacherName || "Testkart";
    const issuedBy = certificate.courseTeacherAcademy || certificate.testTeacherAcademy || teacherName;

    const response: OutputType = {
      id: certificate.id,
      certificateNumber: certificate.certificateNumber,
      studentName: certificate.studentName,
      itemName,
      certificateType: certificate.certificateType,
      completionDate: certificate.completionDate,
      scorePercentage: certificate.scorePercentage,
      issuedBy,
    };

    return new Response(superjson.stringify(response), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching public certificate:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to retrieve certificate.", details: errorMessage }),
      { status: 500 }
    );
  }
}