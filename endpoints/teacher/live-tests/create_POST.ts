import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { slugify } from "../../../helpers/slugify";
import { resolveExamByName } from "../../../helpers/resolveExam";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";
import { Transaction } from "kysely";
import { DB, PrizeDistributionStatus, PrizeFundSource } from "../../../helpers/schema";
import { getTotalPrizePool, sortPrizeTiers, tiersToLegacyPrizes } from "../../../helpers/liveTestPrizeTiers";
import { jsonbParam } from "../../../helpers/jsonbParam";
import { sanitizeHtml } from "../../../helpers/sanitizeHtml";

async function generateUniqueSlug(baseTitle: string, trx: Transaction<DB>): Promise<string> {
  const baseSlug = slugify(baseTitle);

  const existingTest = await trx
    .selectFrom("mockTests")
    .select("id")
    .where("slug", "=", baseSlug)
    .executeTakeFirst();

  if (!existingTest) {
    return baseSlug;
  }

  let counter = 1;
  while (true) {
    const candidateSlug = `${baseSlug}-${counter}`;
    const existing = await trx
      .selectFrom("mockTests")
      .select("id")
      .where("slug", "=", candidateSlug)
      .executeTakeFirst();

    if (!existing) {
      return candidateSlug;
    }
    counter++;
  }
}

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Prize money comes out of the owner's earnings.
    if (teacherRole === "manager" && input.hasPrizes) {
      return new Response(
        superjson.stringify({ error: "Only the account owner can add prize money. Create it without prizes, or ask the owner." }),
        { status: 403 }
      );
    }
    const description = input.description ? sanitizeHtml(input.description) : null;

    // Prize configuration:
    // - has_prizes = false: not_applicable / null
    // - has_prizes = true and price > 0: enrollment funded, pending
    // - has_prizes = true and price = 0: teacher_wallet funded, pending (balance checked at publish time)
    const prizeDistributionStatus: PrizeDistributionStatus = input.hasPrizes
      ? "pending"
      : "not_applicable";
    const prizeFundSource: PrizeFundSource | null = input.hasPrizes
      ? input.price > 0
        ? "enrollment"
        : "teacher_wallet"
      : null;

    const resolvedExam = await resolveExamByName(input.examName);
    const sortedTiers = sortPrizeTiers(input.hasPrizes ? input.prizeTiers : []);
    const legacyPrizes = tiersToLegacyPrizes(sortedTiers);
    const totalPrizePool = getTotalPrizePool(sortedTiers);

    // The mock test, its single test item and the live test are one unit: a
    // failure part way must not leave an orphaned mock test holding a slug.
    const newLiveTest = await db.transaction().execute(async (trx) => {
      const slug = await generateUniqueSlug(input.title, trx);

      const newMockTest = await trx
        .insertInto("mockTests")
        .values({
          teacherId: effectiveTeacherId,
          creatorName: user.displayName,
          title: input.title,
          slug: slug,
          description,
          examId: resolvedExam.examId,
          examName: resolvedExam.examName,
          language: input.language || null,
          thumbnailUrl: input.thumbnailUrl || null,
          introVideoUrl: input.introVideoUrl || null,
          introVideoFileId: input.introVideoFileId || null,
          price: "0", // Price is for the live test event, not the mock test itself
          isFree: input.isFree ?? false,
          whatYouLearn: input.whatYouLearn ? JSON.stringify(input.whatYouLearn) : null,
          requirements: input.requirements ? JSON.stringify(input.requirements) : null,
          isPublished: false,
          totalTests: 1,
          freeTestsCount: 0,
          studentsEnrolled: 0,
          rating: null,
          reviewsCount: 0,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("mockTestItems")
        .values({
          packageId: newMockTest.id,
          orderIndex: 1,
          title: input.title,
          durationMinutes: input.subjectWiseTiming || input.questionWiseTiming ? 0 : input.durationMinutes,
          totalQuestions: 0,
          // Access to a live test paper comes from the live test enrollment
          isFree: false,
          calculatorEnabled: input.calculatorEnabled ?? false,
          subjectWiseTiming: input.subjectWiseTiming ?? false,
          questionWiseTiming: input.questionWiseTiming ?? false,
        })
        .execute();

      return trx
        .insertInto("liveTests")
        .values({
          mockTestId: newMockTest.id,
          title: input.title,
          description,
          teacherId: effectiveTeacherId,
          price: input.price.toString(),
          discountPrice: input.discountPrice != null ? input.discountPrice.toString() : null,
          isFree: input.isFree ?? false,
          startTime: input.startTime || null,
          endTime: input.endTime,
          registrationDeadline: input.registrationDeadline || null,
          maxSeats: input.maxSeats,
          thumbnailUrl: input.thumbnailUrl || null,
          thumbnailFileId: input.thumbnailFileId || null,
          introVideoUrl: input.introVideoUrl || null,
          introVideoFileId: input.introVideoFileId || null,
          hasPrizes: input.hasPrizes,
          prizeTiers: jsonbParam(sortedTiers),
          // Legacy single-rank columns are derived from the tiers and kept in
          // sync purely so lower-stakes surfaces that haven't been migrated to
          // read prizeTiers (e.g. marketing/listing displays) still show a
          // sensible value. Actual distribution reads prizeTiers directly.
          totalPrizePool: totalPrizePool.toString(),
          firstPrize: legacyPrizes.firstPrize.toString(),
          secondPrize: legacyPrizes.secondPrize.toString(),
          thirdPrize: legacyPrizes.thirdPrize.toString(),
          prizeDistributionStatus,
          prizeFundSource,
          enrolledCount: 0,
          isActive: false,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    });

    console.log("Created live test:", newLiveTest.id, "prizeFundSource:", prizeFundSource, "prizeDistributionStatus:", prizeDistributionStatus);

    const output: OutputType = {
      ...newLiveTest,
      price: parseFloat(newLiveTest.price),
      discountPrice: newLiveTest.discountPrice != null ? parseFloat(newLiveTest.discountPrice) : null,
      totalPrizePool: parseFloat(newLiveTest.totalPrizePool),
      firstPrize: parseFloat(newLiveTest.firstPrize),
      secondPrize: parseFloat(newLiveTest.secondPrize),
      thirdPrize: parseFloat(newLiveTest.thirdPrize),
      prizeTiers: sortedTiers,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error creating live test:", error);
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
