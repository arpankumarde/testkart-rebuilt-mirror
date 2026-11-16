import React, { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Hourglass,
  AlertTriangle,
  CheckCircle2,
  FileVideo,
  RefreshCw,
  Trash2,
  Info,
  Clock,
  Sun,
  UploadCloud,
  ExternalLink,
} from "lucide-react";
import { Button } from "./Button";
import { Popover, PopoverTrigger, PopoverContent } from "./Popover";
import { uploadFileToR2 } from "../helpers/useR2Upload";
import { useSaveLiveTeachingVideoMutation, useWithdrawLiveTeachingMutation } from "../helpers/useLiveTeaching";
import { LIVE_TEACHING_VIDEO_FOLDER, LIVE_TEACHING_VIDEO_MAX_MB } from "../helpers/liveTeachingRules";
import { formatDay } from "../helpers/liveTeachingForms";
import type { OutputType as LiveStatus } from "../endpoints/teacher/live-teaching/status_GET.schema";
import styles from "./LiveIntroVideo.module.css";

export const SAMPLE_INTRO_VIDEO_URL = "https://cdn.testkart.in/platform/marketing/live-onboarding-sample.mp4";

const ACCEPTED_VIDEO_TYPES = "video/mp4,video/webm,video/quicktime";

const VIDEO_TIPS = [
  { icon: Clock, title: "1 to 2 minutes", text: "Say hello and what you teach." },
  { icon: Sun, title: "Landscape, good light", text: "A quiet room, face clearly lit." },
  { icon: FileVideo, title: "MP4, MOV or WebM", text: `Up to ${LIVE_TEACHING_VIDEO_MAX_MB} MB.` },
];

const DROP_SPECS = [
  { icon: Clock, label: "1 to 2 min" },
  { icon: Sun, label: "Landscape, well lit" },
  { icon: FileVideo, label: `MP4, MOV, WebM · ${LIVE_TEACHING_VIDEO_MAX_MB} MB` },
];

const VideoTips: React.FC<{ className?: string }> = ({ className }) => (
  <ul className={`${styles.tipList} ${className ?? ""}`}>
    {VIDEO_TIPS.map(({ icon: Icon, title, text }) => (
      <li key={title} className={styles.tip}>
        <span className={styles.tipIcon}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className={styles.tipBody}>
          <span className={styles.tipTitle}>{title}</span>
          <span className={styles.tipText}>{text}</span>
        </span>
      </li>
    ))}
  </ul>
);

/*
 * The intro video body, without its card. Before applying the video changes at
 * once; in review it replaces the one in the application; once approved a new
 * video waits for our team and the current one stays on the profile. A saved
 * video shows as a player with Replace/Remove actions; the dropzone is only for
 * the first upload.
 */
export const LiveIntroVideo: React.FC<{ live: LiveStatus }> = ({ live }) => {
  const saveVideo = useSaveLiveTeachingVideoMutation();
  const withdraw = useWithdrawLiveTeachingMutation();
  const approved = live.status === "approved";
  const pending = live.status === "pending";
  const canEdit = live.isOwner;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<{ name: string; pct: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const busy = !!upload || saveVideo.isPending;

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

  const pickReplacement = () => {
    if (!busy) fileInputRef.current?.click();
  };

  const [dragging, setDragging] = useState(false);

  const onReplacementPicked = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    evt.target.value = "";
    if (file) void uploadPicked(file);
  };

  const onDropFile = (evt: React.DragEvent) => {
    evt.preventDefault();
    setDragging(false);
    const file = evt.dataTransfer.files?.[0];
    if (file && !busy) void uploadPicked(file);
  };

  const uploadPicked = async (file: File) => {
    if (busy) return;
    if (!ACCEPTED_VIDEO_TYPES.split(",").includes(file.type) && !/\.(mp4|mov|webm)$/i.test(file.name)) {
      setUploadError("Pick an MP4, MOV or WebM video.");
      return;
    }
    if (file.size > LIVE_TEACHING_VIDEO_MAX_MB * 1024 * 1024) {
      setUploadError(`This video is over ${LIVE_TEACHING_VIDEO_MAX_MB} MB. Pick a shorter or smaller file.`);
      return;
    }
    setUploadError(null);
    setUpload({ name: file.name, pct: 0 });
    try {
      const res = await uploadFileToR2(file, LIVE_TEACHING_VIDEO_FOLDER, file.name, (pct) =>
        setUpload({ name: file.name, pct })
      );
      save(res.url, res.key);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUpload(null);
    }
  };

  const currentVideo = (url: string, removable: boolean) => {
    const status = approved
      ? { tone: styles.statusLive, text: "Live on your profile" }
      : pending
        ? { tone: styles.statusReview, text: "In your application" }
        : { tone: styles.statusSaved, text: "Saved to your application" };
    const hint = approved
      ? "A new video is reviewed by our team first. This one stays live until then."
      : pending
        ? "A replacement updates the video in your application."
        : "You can replace or remove it any time before you apply.";

    if (!canEdit) {
      return <video className={styles.video} src={url} controls preload="metadata" playsInline />;
    }

    return (
      <div className={styles.player}>
        <video className={styles.playerVideo} src={url} controls preload="metadata" playsInline />
        <div className={styles.toolbar}>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_VIDEO_TYPES}
            className={styles.fileInput}
            onChange={onReplacementPicked}
            tabIndex={-1}
            aria-hidden="true"
          />
          {upload ? (
            <div className={styles.progress} role="status" aria-live="polite">
              <div className={styles.progressHead}>
                <span className={styles.progressName}>
                  <FileVideo size={16} aria-hidden="true" />
                  <span className={styles.progressFile}>{upload.name}</span>
                </span>
                <span className={styles.progressPct}>{upload.pct}%</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${upload.pct}%` }} />
              </div>
            </div>
          ) : (
            <div className={styles.toolbarInfo}>
              <span className={`${styles.status} ${status.tone}`}>
                <CheckCircle2 size={14} aria-hidden="true" />
                {status.text}
              </span>
              <span className={styles.toolbarHint}>{hint}</span>
            </div>
          )}
          <div className={styles.toolbarActions}>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className={styles.infoButton}
                  aria-label="Tips for a good intro video"
                  title="Tips for a good intro video"
                >
                  <Info size={16} aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className={styles.tipsPopover}>
                <p className={styles.tipsHeading}>Tips for a good intro video</p>
                <VideoTips />
              </PopoverContent>
            </Popover>
            {removable && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => save(null, null)}>
                <Trash2 size={15} aria-hidden="true" />
                Remove
              </Button>
            )}
            <Button variant="primary" size="sm" disabled={busy} onClick={pickReplacement}>
              <RefreshCw size={15} aria-hidden="true" className={busy ? styles.spin : undefined} />
              {upload ? "Uploading..." : saveVideo.isPending ? "Saving..." : "Replace video"}
            </Button>
          </div>
        </div>
        {uploadError && !upload && (
          <p className={styles.uploadError} role="alert">
            <AlertTriangle size={15} aria-hidden="true" />
            {uploadError}
          </p>
        )}
      </div>
    );
  };

  const firstUpload = (
    <div className={styles.drop}>
      <div
        className={styles.dropZone}
        data-dragging={dragging || undefined}
        data-busy={busy || undefined}
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-disabled={busy || undefined}
        aria-label="Upload your intro video"
        onClick={pickReplacement}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pickReplacement();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDropFile}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_VIDEO_TYPES}
          className={styles.fileInput}
          onChange={onReplacementPicked}
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
          aria-hidden="true"
        />
        {busy ? (
          <div className={styles.dropProgress} role="status" aria-live="polite">
            <span className={styles.dropIcon}>
              <RefreshCw size={22} aria-hidden="true" className={styles.spin} />
            </span>
            <p className={styles.dropTitle}>{upload ? "Uploading your video" : "Saving your video"}</p>
            <div className={styles.dropBar}>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${upload ? upload.pct : 100}%` }} />
              </div>
              <span className={styles.progressPct}>{upload ? `${upload.pct}%` : ""}</span>
            </div>
            {upload && <p className={styles.dropSub}>{upload.name}</p>}
          </div>
        ) : (
          <>
            <span className={styles.dropIcon}>
              <UploadCloud size={26} aria-hidden="true" />
            </span>
            <p className={styles.dropTitle}>Upload your intro video</p>
            <p className={styles.dropSub}>Drag and drop, or click to browse</p>
            <span className={styles.dropButton}>Choose video</span>
          </>
        )}
      </div>
      {uploadError && !upload && (
        <p className={styles.uploadErrorInline} role="alert">
          <AlertTriangle size={15} aria-hidden="true" />
          {uploadError}
        </p>
      )}
      <div className={styles.dropFoot}>
        <ul className={styles.specs}>
          {DROP_SPECS.map(({ icon: Icon, label }) => (
            <li key={label} className={styles.spec}>
              <Icon size={14} aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
        <a href={SAMPLE_INTRO_VIDEO_URL} target="_blank" rel="noopener noreferrer" className={styles.exampleLink}>
          See an example
          <ExternalLink size={14} aria-hidden="true" />
          <span className={styles.srOnly}>(opens in a new tab)</span>
        </a>
      </div>
    </div>
  );

  return (
    <div className={styles.body}>
      {approved ? (
        <>
          {live.introVideoUrl &&
            (live.pendingVideo ? (
              <video className={styles.video} src={live.introVideoUrl} controls preload="metadata" playsInline />
            ) : (
              currentVideo(live.introVideoUrl, false)
            ))}
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
              {canEdit && !live.introVideoUrl && firstUpload}
            </>
          )}
        </>
      ) : canEdit ? (
        live.introVideoUrl ? currentVideo(live.introVideoUrl, !pending) : firstUpload
      ) : live.introVideoUrl ? (
        <video className={styles.video} src={live.introVideoUrl} controls preload="metadata" playsInline />
      ) : (
        <p className={styles.empty}>Only the account owner can add the intro video.</p>
      )}
    </div>
  );
};