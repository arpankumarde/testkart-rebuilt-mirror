import type { Transaction } from "kysely";
import type { DB } from "./schema";
import { examSlotsTaken, getRunningExamCampaigns, type Campaign } from "./teacherCampaign";
import { examBonusTitle } from "./teacherCampaignRules";

export type ExamCampaignLimits = { totalSlots: number; amount: number; perTeacher: number };

export type StartExamCampaignInput = ExamCampaignLimits & {
  examId: number;
  examNewsPostId?: number | null;
  days: number;
  minTests: number;
  minQuestions: number;
};

export type EditExamCampaignInput = ExamCampaignLimits & { id: number; endsAt: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

async function lockExamCampaign(trx: Transaction<DB>, id: number): Promise<Campaign> {
  const campaign = await trx
    .selectFrom("teacherCampaigns")
    .selectAll()
    .where("id", "=", id)
    .where("kind", "=", "exam")
    .forUpdate()
    .executeTakeFirst();
  if (!campaign) throw new Error("This Exam Bonus no longer exists.");
  return campaign;
}

const assertStillRunning = (campaign: Campaign, now: Date) => {
  if (!campaign.endsAt || campaign.endsAt <= now) throw new Error("This Exam Bonus has ended. Start a new one instead.");
};

/** Starts an Exam Bonus now. Teachers see it at once. Only one can run per exam. */
export async function startExamCampaign(trx: Transaction<DB>, input: StartExamCampaignInput, now = new Date()): Promise<Campaign> {
  const exam = await trx
    .selectFrom("exams")
    .select(["id", "examName"])
    .where("id", "=", input.examId)
    .forUpdate()
    .executeTakeFirst();
  if (!exam) throw new Error("This exam no longer exists.");
  const title = examBonusTitle(exam.examName);
  const running = await getRunningExamCampaigns(trx, now);
  if (running.some((campaign) => campaign.examId === exam.id)) throw new Error(`The ${title} is already running.`);

  // The table requires a positive course amount; maxCourses 0 and the kind keep courses out.
  const amount = input.amount.toFixed(2);
  return trx
    .insertInto("teacherCampaigns")
    .values({
      slug: `exam-bonus-${exam.id}-${now.getTime()}`,
      title,
      kind: "exam",
      examId: exam.id,
      examNewsPostId: input.examNewsPostId ?? null,
      totalSlots: input.totalSlots,
      isActive: true,
      startsAt: now,
      endsAt: new Date(now.getTime() + input.days * DAY_MS),
      mockTestAmount: amount,
      courseAmount: amount,
      maxMockTests: input.perTeacher,
      maxCourses: 0,
      minTests: input.minTests,
      minQuestions: input.minQuestions,
      minVideos: 0,
      minVideoMinutes: 0,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** Changes a running Exam Bonus. Claims already made keep the amount they were made at. */
export async function editExamCampaign(trx: Transaction<DB>, input: EditExamCampaignInput, now = new Date()): Promise<Campaign> {
  const campaign = await lockExamCampaign(trx, input.id);
  assertStillRunning(campaign, now);
  if (input.endsAt <= now) throw new Error("Pick an end date in the future, or use End now.");

  const taken = (await examSlotsTaken(trx, [campaign.id])).get(campaign.id) ?? 0;
  if (input.totalSlots < taken) throw new Error(`${taken} slots are already taken, so it cannot go below ${taken}.`);

  const busiest = await trx
    .selectFrom("teacherCampaignClaims")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("campaignId", "=", campaign.id)
    .where("status", "in", ["claimed", "credited"])
    .groupBy("teacherId")
    .orderBy("count", "desc")
    .executeTakeFirst();
  const most = Number(busiest?.count ?? 0);
  if (input.perTeacher < most) throw new Error(`A teacher already holds ${most} slots, so the limit cannot go below ${most}.`);

  const amount = input.amount.toFixed(2);
  return trx
    .updateTable("teacherCampaigns")
    .set({
      totalSlots: input.totalSlots,
      mockTestAmount: amount,
      courseAmount: amount,
      maxMockTests: input.perTeacher,
      endsAt: input.endsAt,
      updatedAt: now,
    })
    .where("id", "=", campaign.id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** Stops new claims. Claims already waiting can still be credited or declined. */
export async function endExamCampaign(trx: Transaction<DB>, id: number, now = new Date()): Promise<Campaign> {
  const campaign = await lockExamCampaign(trx, id);
  assertStillRunning(campaign, now);
  return trx
    .updateTable("teacherCampaigns")
    .set({ endsAt: now, updatedAt: now })
    .where("id", "=", campaign.id)
    .returningAll()
    .executeTakeFirstOrThrow();
}