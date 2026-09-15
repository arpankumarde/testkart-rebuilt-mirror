import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./history_GET.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

const DEFAULT_LIMIT = 10;

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    // Block managers from owner-only features
    if (teacherRole === 'manager') {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(
      url.searchParams.get("limit") || `${DEFAULT_LIMIT}`,
      10
    );
    const offset = (page - 1) * limit;

    const transactionsQuery = db
      .selectFrom("subscriptionTransactions")
      .innerJoin(
        "subscriptionPlans",
        "subscriptionTransactions.planId",
        "subscriptionPlans.id"
      )
      .where("subscriptionTransactions.teacherId", "=", effectiveTeacherId)
      .where("subscriptionTransactions.status", "in", ["completed", "pending"]);

    const transactions = await transactionsQuery
      .selectAll("subscriptionTransactions")
      .select(["subscriptionPlans.name as planName"])
      .orderBy("subscriptionTransactions.transactionDate", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const { count } = await transactionsQuery
      .select((eb) => eb.fn.countAll().as("count"))
      .executeTakeFirstOrThrow();

    const output: OutputType = {
      transactions: transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
      })),
      totalCount: Number(count),
      page,
      limit,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching subscription history:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 401,
      });
    }
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