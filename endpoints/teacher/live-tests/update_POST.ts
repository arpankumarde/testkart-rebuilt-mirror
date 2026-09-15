import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { resolveExamByName } from "../../../helpers/resolveExam";
import { countLiveTestEnrollments } from "../../../helpers/enrollmentCounters";
import { applyLiveTestUpdate, LiveTestUpdateError } from "../../../helpers/liveTestUpdate";
import { parseStoredPrizeTiers } from "../../../helpers/liveTestPrizeTiers";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const updatedTest = await applyLiveTestUpdate(db, effectiveTeacherId, input, {
      resolveExam: resolveExamByName,
      countEnrollments: (liveTestId) => countLiveTestEnrollments(liveTestId),
    });

    const output: OutputType = {
      ...updatedTest,
      price: parseFloat(updatedTest.price),
      discountPrice: updatedTest.discountPrice != null ? parseFloat(updatedTest.discountPrice) : null,
      totalPrizePool: parseFloat(updatedTest.totalPrizePool),
      firstPrize: parseFloat(updatedTest.firstPrize),
      secondPrize: parseFloat(updatedTest.secondPrize),
      thirdPrize: parseFloat(updatedTest.thirdPrize),
      prizeTiers: parseStoredPrizeTiers(updatedTest.prizeTiers),
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof LiveTestUpdateError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Error updating live test:", error);
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}
