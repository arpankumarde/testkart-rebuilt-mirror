import {
  CamelCasePlugin,
  CompiledQuery,
  DatabaseConnection,
  Driver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  QueryResult,
} from "kysely";
import type { DB } from "./schema";
import { checkEmailOtpRateLimit, checkOtpRateLimit } from "./otpRateLimit";

type Axis = "mobile_number" | "user_id" | "ip_address" | "email";

/**
 * A Kysely instance whose driver answers from a script instead of Postgres:
 * count queries get [hour, day] for the axis in their WHERE clause, and the
 * cooldown lookup gets a row created `lastSecondsAgo` seconds ago.
 */
const fakeDb = (counts: Partial<Record<Axis, [number, number]>>, lastSecondsAgo?: number) => {
  const statements: string[] = [];
  const connection: DatabaseConnection = {
    async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
      statements.push(query.sql);
      if (!query.sql.includes("count(")) {
        const rows = lastSecondsAgo === undefined ? [] : [{ created_at: new Date(Date.now() - lastSecondsAgo * 1000) }];
        return { rows: rows as R[] };
      }
      const axis = (Object.keys(counts) as Axis[]).find((key) => query.sql.includes(`"${key}" =`));
      const [hour, day] = axis ? counts[axis]! : [0, 0];
      return { rows: [{ hour_count: String(hour), day_count: String(day) }] as R[] };
    },
    async *streamQuery() {
      throw new Error("not used");
    },
  };
  const driver: Driver = {
    async init() {},
    async acquireConnection() {
      return connection;
    },
    async beginTransaction() {},
    async commitTransaction() {},
    async rollbackTransaction() {},
    async releaseConnection() {},
    async destroy() {},
  };
  const db = new Kysely<DB>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (k) => new PostgresIntrospector(k),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
  });
  return { db, statements };
};

const sms = { mobileNumber: "9876543210", ipAddress: "203.0.113.7" };

describe("checkOtpRateLimit", () => {
  it("allows a signed-in send with nothing recent, and checks the user axis", async () => {
    const { db, statements } = fakeDb({});
    expect(await checkOtpRateLimit(db, { ...sms, userId: 42 })).toEqual({ allowed: true });
    expect(statements.some((sql) => sql.includes('"user_id" ='))).toBe(true);
  });

  it("leaves login and signup (no userId) without a user-axis query", async () => {
    const { db, statements } = fakeDb({});
    expect(await checkOtpRateLimit(db, sms)).toEqual({ allowed: true });
    expect(statements.some((sql) => sql.includes('"user_id"'))).toBe(false);
  });

  it("blocks a signed-in user at 5 sends in the hour", async () => {
    const { db } = fakeDb({ user_id: [5, 5] });
    expect(await checkOtpRateLimit(db, { ...sms, userId: 42 })).toEqual({
      allowed: false,
      message: "Too many OTP requests from your account. Please try again in an hour.",
    });
  });

  it("blocks a signed-in user at 10 sends in the day", async () => {
    const { db } = fakeDb({ user_id: [1, 10] });
    expect(await checkOtpRateLimit(db, { ...sms, userId: 42 })).toEqual({
      allowed: false,
      message: "Too many OTP requests from your account today. Please try again tomorrow.",
    });
  });

  it("allows a signed-in user just under both caps", async () => {
    const { db } = fakeDb({ user_id: [4, 9] });
    expect(await checkOtpRateLimit(db, { ...sms, userId: 42 })).toEqual({ allowed: true });
  });

  it("still applies the per-number cooldown and caps first", async () => {
    expect(await checkOtpRateLimit(fakeDb({}, 10.5).db, { ...sms, userId: 42 })).toEqual({
      allowed: false,
      message: "Please wait 35 seconds before requesting another OTP.",
    });
    expect(await checkOtpRateLimit(fakeDb({ mobile_number: [5, 5], user_id: [5, 5] }).db, { ...sms, userId: 42 })).toEqual({
      allowed: false,
      message: "Too many OTP requests for this number. Please try again in an hour.",
    });
  });

  it("still applies the per-IP caps", async () => {
    const { db } = fakeDb({ ip_address: [8, 8] });
    expect(await checkOtpRateLimit(db, { ...sms, userId: 42 })).toEqual({
      allowed: false,
      message: "Too many OTP requests from your network. Please try again in an hour.",
    });
  });
});

describe("checkEmailOtpRateLimit", () => {
  const input = { email: "someone@example.com", userId: 42 };

  it("allows a send with nothing recent", async () => {
    expect(await checkEmailOtpRateLimit(fakeDb({}).db, input)).toEqual({ allowed: true });
  });

  it("enforces the cooldown per address", async () => {
    expect(await checkEmailOtpRateLimit(fakeDb({}, 10.5).db, input)).toEqual({
      allowed: false,
      message: "Please wait 35 seconds before requesting another code.",
    });
  });

  it("blocks an address at 5 sends in the hour", async () => {
    expect(await checkEmailOtpRateLimit(fakeDb({ email: [5, 5] }).db, input)).toEqual({
      allowed: false,
      message: "Too many verification emails to this address. Please try again in an hour.",
    });
  });

  it("blocks an address at 8 sends in the day", async () => {
    expect(await checkEmailOtpRateLimit(fakeDb({ email: [1, 8] }).db, input)).toEqual({
      allowed: false,
      message: "Too many verification emails to this address today. Please try again tomorrow.",
    });
  });

  it("blocks a user rotating addresses at 10 sends in the day", async () => {
    expect(await checkEmailOtpRateLimit(fakeDb({ user_id: [2, 10] }).db, input)).toEqual({
      allowed: false,
      message: "Too many verification emails from your account today. Please try again tomorrow.",
    });
  });
});
