import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { db } from '../../../helpers/db';
import { getAdminServerSessionOrThrow } from '../../../helpers/getAdminSession';
import { sql } from "kysely";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'manager']);

    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());
    const query = {
      search: searchParams.search,
      sortBy: searchParams.sortBy || undefined,
      sortOrder: searchParams.sortOrder || undefined,
      page: searchParams.page ? parseInt(searchParams.page, 10) : undefined,
      limit: searchParams.limit ? parseInt(searchParams.limit, 10) : undefined
    };

    const params = schema.parse(query);

    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let baseQuery = db.selectFrom("deletedAccounts");

    if (params.search) {
      const searchTerm = `%${params.search}%`;
      baseQuery = baseQuery.where((eb) =>
      eb.or([
      eb("displayName", "ilike", searchTerm),
      eb("email", "ilike", searchTerm)]
      )
      );
    }

    const [{ count }] = await baseQuery.
    select((eb) => eb.fn.count<number>("id").as("count")).
    execute();

    const totalCount = Number(count);
    const totalPages = Math.ceil(totalCount / limit);

    let listQuery = baseQuery.selectAll();
    if (params.sortBy) {
      const direction = params.sortOrder === "desc" ? "desc" : "asc";
      listQuery = listQuery.orderBy(params.sortBy, sql`${sql.raw(direction)} nulls last`);
    }

    const accounts = await listQuery.
    orderBy("deletedAt", "desc").
    orderBy("id", "desc").
    limit(limit).
    offset(offset).
    execute();

    const result = {
      accounts,
      totalCount,
      currentPage: page,
      totalPages
    };

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}