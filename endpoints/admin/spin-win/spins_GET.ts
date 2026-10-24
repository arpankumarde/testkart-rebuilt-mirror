import { runAdminSpin } from "../../../helpers/spinWinAdmin";
import { couponStatusOrNull, spinColumns, spinsQuery } from "../../../helpers/spinWinAdminQueries";
import type { RewardSnapshot } from "../../../helpers/spinWinServer";
import type { SpinCouponStatus } from "../../../helpers/spinWinRules";
import { schema, type OutputType } from "./spins_GET.schema";

export async function handle(request: Request) {
  return runAdminSpin(request, async () => {
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const base = spinsQuery(input);
    const [rows, count] = await Promise.all([
      base
        .select([...spinColumns, couponStatusOrNull.as("couponStatus")])
        .orderBy("s.spunAt", "desc")
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize)
        .execute(),
      base.select((eb) => eb.fn.countAll<string>().as("n")).executeTakeFirst(),
    ]);
    const output: OutputType = {
      rows: rows.map((row) => ({
        id: String(row.id),
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        userId: row.userId,
        studentName: row.studentName,
        studentEmail: row.studentEmail,
        studentMobile: row.studentMobile,
        spunAs: row.spunAs as "user" | "guest",
        sessionRef: row.guestSessionId ? row.guestSessionId.slice(0, 8) : null,
        spunAt: row.spunAt,
        rewardName: (row.rewardSnapshot as unknown as RewardSnapshot).name,
        claimStatus: row.claimStatus,
        claimedAt: row.claimedAt,
        forfeitReason: row.forfeitReason,
        couponCode: row.couponCode,
        couponStatus: row.couponStatus as SpinCouponStatus | null,
      })),
      total: Number(count?.n ?? 0),
      page: input.page,
      pageSize: input.pageSize,
    };
    return output;
  });
}