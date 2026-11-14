import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { getLiveTeachingState } from "../../../helpers/liveTeachingServer";
import { OutputType } from "./status_GET.schema";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Only teachers can view this." }), { status: 403 });
    }

    const state = await getLiveTeachingState(effectiveTeacherId);
    if (!state) {
      return new Response(superjson.stringify({ error: "Teacher not found" }), { status: 404 });
    }

    const latest = state.latestApplication;
    const video = state.status === "approved" ? state.latestVideoChange : null;
    const output: OutputType = {
      status: state.status,
      checklist: state.checklist,
      contact: state.contact,
      introVideoUrl: state.introVideoUrl,
      decisionReason:
        latest && (latest.status === "rejected" || latest.status === "revoked") ? latest.decisionReason : null,
      appliedAt: latest?.createdAt ?? null,
      decidedAt: latest?.decidedAt ?? null,
      withdrawnAt: latest?.status === "withdrawn" ? latest.decidedAt : null,
      pendingVideo: video?.status === "pending" ? { url: video.introVideoUrl, sentAt: video.createdAt } : null,
      videoRejection: video?.status === "rejected" ? { reason: video.decisionReason, decidedAt: video.decidedAt } : null,
      isOwner: user.teacherRole !== "manager",
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching live teaching status:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}