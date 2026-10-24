import { runAdminSpin } from "../../../helpers/spinWinAdmin";
import { couponColumns, couponOrderIdSql, couponsQuery } from "../../../helpers/spinWinAdminQueries";
import { spinCouponStatusSql } from "../../../helpers/spinWinServer";
import type { SpinCouponStatus } from "../../../helpers/spinWinRules";
import { schema, type OutputType } from "./coupons_GET.schema";

export async function handle(request: Request) {
  return runAdminSpin(request, async () => {
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const base = couponsQuery(input);
    let listQuery = base.select([...couponColumns, spinCouponStatusSql.as("status"), couponOrderIdSql.as("orderId")]);
    listQuery =
      input.sort === "issued_asc"
        ? listQuery.orderBy("sc.issuedAt", "asc")
        : input.sort === "expires_asc"
          ? listQuery.orderBy("sc.expiresAt", "asc")
          : input.sort === "expires_desc"
            ? listQuery.orderBy("sc.expiresAt", "desc")
            : listQuery.orderBy("sc.issuedAt", "desc");
    const [rows, count] = await Promise.all([
      listQuery.orderBy("sc.id", "desc").limit(input.pageSize).offset((input.page - 1) * input.pageSize).execute(),
      base.select((eb) => eb.fn.countAll<string>().as("n")).executeTakeFirst(),
    ]);
    const output: OutputType = {
      rows: rows.map((row) => ({
        ...row,
        discountType: row.discountType as "percentage" | "flat",
        discountValue: Number(row.discountValue),
        minOrderValue: Number(row.minOrderValue),
        maxDiscountAmount: row.maxDiscountAmount === null ? null : Number(row.maxDiscountAmount),
        status: row.status as SpinCouponStatus,
        orderId: row.orderId === null ? null : Number(row.orderId),
      })),
      total: Number(count?.n ?? 0),
      page: input.page,
      pageSize: input.pageSize,
    };
    return output;
  });
}