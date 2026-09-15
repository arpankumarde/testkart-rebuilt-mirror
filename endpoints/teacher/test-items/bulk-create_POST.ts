import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { syncMockTestAggregates } from "../../../helpers/syncMockTestAggregates";
import { nextFreeTestTitles } from "../../../helpers/testSeriesEditing";
import { schema, OutputType } from "./bulk-create_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
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

    const parentPackage = await db
      .selectFrom("mockTests")
      .select("teacherId")
      .where("id", "=", input.packageId)
      .executeTakeFirst();

    if (!parentPackage) {
      return new Response(
        superjson.stringify({ error: "Package not found" }),
        { status: 404 }
      );
    }

    if (parentPackage.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "You do not own this package" }),
        { status: 403 }
      );
    }

    // Positions count every row, trashed ones included, so a restored item
    // never shares an orderIndex. Names count only live items.
    const existingItems = await db
      .selectFrom("mockTestItems")
      .select(["title", "orderIndex", "deletedAt"])
      .where("packageId", "=", input.packageId)
      .execute();

    const maxOrderIndex = existingItems.reduce((max, item) => Math.max(max, item.orderIndex), -1);
    const liveTitles = existingItems.filter((item) => item.deletedAt === null).map((item) => item.title);
    const titles = nextFreeTestTitles(liveTitles, input.count, liveTitles.length + 1);

    const itemsToInsert = titles.map((title, index) => ({
      packageId: input.packageId,
      title,
      durationMinutes: 60,
      isFree: false,
      calculatorEnabled: false,
      subjectWiseTiming: false,
      questionWiseTiming: false,
      orderIndex: maxOrderIndex + 1 + index,
      subject: "",
    }));

    const newItems = await db
      .insertInto("mockTestItems")
      .values(itemsToInsert)
      .returningAll()
      .execute();

        await syncMockTestAggregates(input.packageId).catch(err => console.error("Failed to sync aggregates:", err));

    return new Response(superjson.stringify(newItems satisfies OutputType));
  } catch (error) {
    console.error("Error bulk creating test items:", error);
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