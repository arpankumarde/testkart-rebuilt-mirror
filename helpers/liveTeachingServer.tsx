import { db } from "./db";
import { MENTORSHIP_MIN_RATE_PER_UNIT } from "./liveLessonConfig";
import {
  asStringList,
  buildLiveTeachingChecklist,
  toLiveTeachingStatus,
  type LiveTeachingChecklistItem,
  type LiveTeachingStatus,
} from "./liveTeachingRules";

export type LiveTeachingState = {
  status: LiveTeachingStatus;
  checklist: LiveTeachingChecklistItem[];
  introVideoUrl: string | null;
  introVideoFileId: string | null;
  ratePerUnit: number | null;
  latestApplication: {
    id: string;
    status: string;
    decisionReason: string | null;
    decidedAt: Date | null;
    createdAt: Date;
  } | null;
  /** The latest replacement video an approved teacher sent for review (kind 'video'). */
  latestVideoChange: {
    id: string;
    status: string;
    introVideoUrl: string;
    decisionReason: string | null;
    createdAt: Date;
    decidedAt: Date | null;
  } | null;
};

/** The teacher's live teaching status, apply checklist and latest application. */
export async function getLiveTeachingState(teacherId: number): Promise<LiveTeachingState | null> {
  const user = await db
    .selectFrom("users")
    .select([
      "avatarUrl",
      "tagline",
      "bio",
      "expertiseAreas",
      "teachingCategories",
      "languages",
      "mentorshipRatePerUnit",
      "introVideoUrl",
      "introVideoFileId",
      "liveTeachingStatus",
    ])
    .where("id", "=", teacherId)
    .executeTakeFirst();
  if (!user) return null;

  const [hours, latest, videoChange] = await Promise.all([
    db
      .selectFrom("mentorshipAvailability")
      .select(db.fn.countAll<string>().as("n"))
      .where("teacherId", "=", teacherId)
      .where("isActive", "=", true)
      .executeTakeFirst(),
    db
      .selectFrom("liveTeachingApplications")
      .select(["id", "status", "decisionReason", "decidedAt", "createdAt"])
      .where("teacherId", "=", teacherId)
      .where("kind", "=", "application")
      .orderBy("createdAt", "desc")
      .limit(1)
      .executeTakeFirst(),
    db
      .selectFrom("liveTeachingApplications")
      .select(["id", "status", "introVideoUrl", "decisionReason", "createdAt", "decidedAt"])
      .where("teacherId", "=", teacherId)
      .where("kind", "=", "video")
      .orderBy("createdAt", "desc")
      .limit(1)
      .executeTakeFirst(),
  ]);

  const subjects = Array.from(
    new Set([...asStringList(user.expertiseAreas), ...asStringList(user.teachingCategories)])
  );
  const ratePerUnit = user.mentorshipRatePerUnit !== null ? Number(user.mentorshipRatePerUnit) : null;

  return {
    status: toLiveTeachingStatus(user.liveTeachingStatus),
    checklist: buildLiveTeachingChecklist({
      avatarUrl: user.avatarUrl,
      tagline: user.tagline,
      bio: user.bio,
      subjects,
      languages: asStringList(user.languages),
      ratePerUnit,
      minRatePerUnit: MENTORSHIP_MIN_RATE_PER_UNIT,
      activeHourWindows: Number(hours?.n ?? 0),
      introVideoUrl: user.introVideoUrl,
    }),
    introVideoUrl: user.introVideoUrl,
    introVideoFileId: user.introVideoFileId,
    ratePerUnit,
    latestApplication: latest ?? null,
    latestVideoChange: videoChange ?? null,
  };
}