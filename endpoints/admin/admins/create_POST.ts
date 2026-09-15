import { schema, OutputType } from "./create_POST.schema";
import superjson from 'superjson';
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import bcrypt from 'bcryptjs';

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin']);

    const json = superjson.parse(await request.text());
    const result = schema.parse(json);

    const existingAdmin = await db
      .selectFrom('admins')
      .select('id')
      .where('email', '=', result.email)
      .executeTakeFirst();

    if (existingAdmin) {
      throw new Error("Admin with this email already exists");
    }

    const passwordHash = await bcrypt.hash(result.password, 10);

    await db.insertInto('admins')
      .values({
        email: result.email,
        fullName: result.fullName,
        passwordHash,
        role: result.role,
        isActive: true,
      })
      .execute();

    return new Response(superjson.stringify({ success: true, message: "Admin created successfully" } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}