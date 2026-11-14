import React, { useState } from "react";
import { toast } from "sonner";
import { Hourglass, AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { VideoUploader } from "./VideoUploader";
import { useSaveLiveTeachingVideoMutation, useWithdrawLiveTeachingMutation } from "../helpers/useLiveTeaching";
import { LIVE_TEACHING_VIDEO_FOLDER, LIVE_TEACHING_VIDEO_MAX_MB } from "../helpers/liveTeachingRules";
import { formatDay } from "../helpers/liveTeachingForms";
import type { OutputType as LiveStatus } from "../endpoints/teacher/live-teaching/status_GET.schema";
import styles from "./LiveIntroVideo.module.css";

export const SAMPLE_INTRO_VIDEO_URL = "https://cdn.testkart.in/platform/marketing/live-onboarding-sample.mp4";

/*
 * The intro video body, without its card. Before applying the video changes at
 * once; in review it replaces the one in the application; once approved a new
 * video waits for our team and the current one stays on the profile.
 */
export const LiveIntroVideo: React.FC<{ live: LiveStatus }> = ({ live }) => {
  const saveVideo = useSaveLiveTeachingVideoMutation();
  const withdraw = useWithdrawLiveTeachingMutation();
  const approved = live.status === "approved";
  const pending = live.status === "pending";
  const canEdit = live.isOwner;
  const [uploaderKey, setUploaderKey] = useState(0);

  const save = (url: string | null, fileId: string | null) => {
    if (!url && (approved || pending)) return;
    saveVideo.mutate(
      { introVideoUrl: url, introVideoFileId: fileId },
      {
        onSuccess: (res) => {
          toast.success(
            res.inReview
              ? "New video sent for review. Your current video stays on your profile until it is approved."
              : !url
                ? "Intro video removed."
                : pending
                  ? "Video updated in your application."
                  : "Intro video saved."
          );
          setUploaderKey((k) => k + 1);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save the video."),
      }
    );
  };

  const cancelChange = () =>
    withdraw.mutate(
      { what: "video" },
      {
        onSuccess: () => toast.success("New video withdrawn. Your current video stays on your profile."),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not withdraw the video."),
      }
    );

  const uploader = (label: string, current: string | undefined, removable: boolean) => (
    <VideoUploader
      key={uploaderKey}
      folder={LIVE_TEACHING_VIDEO_FOLDER}
      maxSizeInMB={LIVE_TEACHING_VIDEO_MAX_MB}
      currentVideoUrl={current}
      label={label}
      onSuccess={({ url, videoFileId }) => save(url || null, url ? videoFileId : null)}
      onRemove={removable ? () => save(null, null) : undefined}
      onError={(err) => toast.error(err.message)}
    />
  );

  return (
    <div className={styles.body}>
      {approved ? (
        <>
          {live.introVideoUrl && (
            <video className={styles.video} src={live.introVideoUrl} controls preload="metadata" playsInline />
          )}
          {live.pendingVideo ? (
            <div className={styles.review}>
              <p className={styles.reviewTitle}>
                <Hourglass size={15} aria-hidden="true" />
                New video in review since {formatDay(live.pendingVideo.sentAt)}
              </p>
              <video className={styles.video} src={live.pendingVideo.url} controls preload="metadata" playsInline />
              {canEdit && (
                <div className={styles.reviewActions}>
                  <Button variant="outline" size="sm" disabled={withdraw.isPending} onClick={cancelChange}>
                    {withdraw.isPending ? "Withdrawing..." : "Withdraw new video"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              {live.videoRejection && (
                <p className={styles.rejected}>
                  <AlertTriangle size={15} aria-hidden="true" />
                  Your last new video was not approved
                  {live.videoRejection.reason ? `: ${live.videoRejection.reason}` : "."}
                </p>
              )}
              {canEdit && uploader("Upload a new video", undefined, false)}
            </>
          )}
        </>
      ) : canEdit ? (
        uploader("Upload your intro video", live.introVideoUrl ?? undefined, !pending)
      ) : live.introVideoUrl ? (
        <video className={styles.video} src={live.introVideoUrl} controls preload="metadata" playsInline />
      ) : (
        <p className={styles.empty}>Only the account owner can add the intro video.</p>
      )}

      {canEdit && !live.pendingVideo && (
        <ul className={styles.tips}>
          <li>1 to 2 minutes. Say hello, what you teach and how a class with you goes.</li>
          <li>Film in landscape, in a quiet room with good light.</li>
          <li>MP4, MOV or WebM, up to {LIVE_TEACHING_VIDEO_MAX_MB} MB.</li>
        </ul>
      )}
    </div>
  );
};

export const SampleIntroVideo: React.FC<{ caption?: string }> = ({ caption }) => (
  <figure className={styles.sample}>
    <video
      className={styles.video}
      src={SAMPLE_INTRO_VIDEO_URL}
      controls
      preload="metadata"
      playsInline
      aria-label="Sample intro video"
    />
    {caption && <figcaption className={styles.sampleCaption}>{caption}</figcaption>}
  </figure>
);