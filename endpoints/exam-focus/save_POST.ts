import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { ExamFocusError, saveExamFocus } from "../../helpers/examFocus";
import { schema, OutputType } from "./save_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, teacherRole } = await getServerUserSession(request);

    if (user.role !== "student" && user.role !== "teacher") {
      return new Response(
        superjson.stringify({ error: "Exam focus is only for student and teacher accounts." }),
        { status: 403 }
      );
    }
    if (teacherRole === "manager") {
      return new Response(
        superjson.stringify({ error: "Only the account owner can change the academy's exam focus." }),
        { status: 403 }
      );
    }

    const { examIds } = schema.parse(superjson.parse(await request.text()));
    const examFocus = await db
      .transaction()
      .execute((trx) => saveExamFocus(trx, user.id, user.role, examIds));

    return new Response(superjson.stringify({ examFocus } satisfies OutputType));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    if (error instanceof ZodError) {
      return new Response(
        superjson.stringify({ error: error.errors[0]?.message ?? "Invalid exam selection." }),
        { status: 400 }
      );
    }
    if (error instanceof ExamFocusError) {
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    console.error("[exam-focus/save_POST] Error saving exam focus:", error);
    return new Response(superjson.stringify({ error: "Could not save your exams. Please try again." }), {
      status: 500,
    });
  }
}