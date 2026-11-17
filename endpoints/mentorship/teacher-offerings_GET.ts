import { db } from "../../helpers/db";
import { schema, OutputType } from "./teacher-offerings_GET.schema";
import { MENTORSHIP_SESSION_DURATIONS } from "../../helpers/liveLessonConfig";
import { classPriceFor, pricesMeetFloors, resolveLivePrices } from "../../helpers/livePricing";
import { getLiveBalance, getLivePackageFor, getTrialState } from "../../helpers/livePackages";
import { teacherMaxClassesPerWeek } from "../../helpers/mentorshipSlots";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import superjson from "superjson";

const TEACHER_COLUMNS = [
  "id",
  "slug",
  "displayName",
  "avatarUrl",
  "bio",
  "tagline",
  "timezone",
  "mentorshipEnabled",
  "mentorshipRatePerUnit",
  "mentorshipClassPrice60",
  "mentorshipTrialDiscount",
  "liveTeachingStatus",
  "introVideoUrl",
] as const;

const findTeacher = async (by: { id: number } | { slug: string }) =>
  db
    .selectFrom("teachers")
    .select(TEACHER_COLUMNS)
    .$call((q) => ("id" in by ? q.where("id", "=", by.id) : q.where("slug", "=", by.slug)))
    .executeTakeFirst();

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const input = schema.parse({
      teacherId: url.searchParams.get("teacherId") ?? undefined,
      teacherSlug: url.searchParams.get("teacherSlug") ?? undefined,
    });

    const teacher = input.teacherSlug
      ? await findTeacher({ slug: input.teacherSlug })
      : await findTeacher({ id: input.teacherId as number });

    if (!teacher) {
      return new Response(superjson.stringify({ error: "Teacher not found" }), { status: 404 });
    }
    const teacherId = teacher.id;

    const approved = teacher.liveTeachingStatus === "approved";
    const resolved = resolveLivePrices(teacher);
    const enabled = approved && !!teacher.mentorshipEnabled && !!resolved && pricesMeetFloors(resolved);
    const prices = enabled ? resolved : null;
    const maxClassesPerWeek = enabled ? await teacherMaxClassesPerWeek(teacherId) : 0;

    let trialState: OutputType["trialState"] = null;
    let activePackageId: string | null = null;
    let balance: number | null = null;
    try {
      const { user } = await getServerUserSession(request);
      if (user.role === "student") {
        const [state, pkg, bal] = await Promise.all([
          getTrialState(user.id, teacherId),
          getLivePackageFor(user.id, teacherId),
          getLiveBalance(user.id),
        ]);
        trialState = state;
        activePackageId = pkg?.id ?? null;
        balance = Math.max(0, bal);
      }
    } catch (error) {
      if (!(error instanceof NotAuthenticatedError)) throw error;
    }

    const output: OutputType = {
      teacher: {
        id: teacher.id,
        slug: teacher.slug,
        displayName: teacher.displayName,
        avatarUrl: teacher.avatarUrl,
        bio: teacher.bio,
        tagline: teacher.tagline,
        timezone: teacher.timezone,
      },
      enabled,
      introVideoUrl: approved ? teacher.introVideoUrl : null,
      durations: prices
        ? MENTORSHIP_SESSION_DURATIONS.map((minutes) => ({ durationMinutes: minutes, price: classPriceFor(prices, minutes) }))
        : [],
      prices,
      maxClassesPerWeek,
      isTrialEligible: trialState === "eligible",
      trialState,
      activePackageId,
      balance,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching mentorship teacher offerings:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
