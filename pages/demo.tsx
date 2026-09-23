import React, { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpen, Youtube } from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import { TeacherVideoFrame } from "../components/TeacherVideoFrame";
import { TeacherCtaBanner } from "../components/TeacherCtaBanner";
import {
  ALL_TEACHER_VIDEOS,
  TEACHER_VIDEO_GROUPS,
  TESTKART_CHANNEL_URL,
  findTeacherVideo,
  formatVideoDuration,
  type TeacherVideo,
} from "../helpers/teacherVideos";
import styles from "./demo.module.css";

const DEFAULT_VIDEO = ALL_TEACHER_VIDEOS[0];

const ListThumb = ({ video }: { video: TeacherVideo }) =>
  video.source === "youtube" ? (
    <img
      src={`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`}
      alt=""
      width={320}
      height={180}
      loading="lazy"
      decoding="async"
      className={styles.thumb}
    />
  ) : (
    <span className={`${styles.thumb} ${styles.thumbGuide}`} aria-hidden="true">
      Guide clip
    </span>
  );

export default function DemoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const current = findTeacherVideo(searchParams.get("v")) ?? DEFAULT_VIDEO;
  // Only a video the visitor picked here starts on its own; a shared ?v= link waits for Play.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const pick = (video: TeacherVideo) => {
    setPickedId(video.id);
    setSearchParams({ v: video.id }, { replace: true, preventScrollReset: true });
    const player = playerRef.current;
    if (player && player.getBoundingClientRect().top < 0) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      player.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  };

  const duration = formatVideoDuration(current.durationSeconds);

  return (
    <div className={styles.page}>
      <SEOHead
        title="Teacher video walkthroughs"
        description="Short videos that show teachers how to create and sell mock tests, live tests, notes, PDFs and courses on Testkart, and how to get paid."
      />

      <header className={styles.intro}>
        <h1 className={styles.title}>Watch how Testkart works</h1>
        <p className={styles.lead}>
          Short videos of each task in the teacher dashboard, from your first test series to your first payout. Pick
          one to start.
        </p>
        <p className={styles.links}>
          <a href={TESTKART_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className={styles.textLink}>
            <Youtube size={18} aria-hidden="true" />
            Testkart on YouTube
          </a>
          <Link to="/help" className={styles.textLink}>
            <BookOpen size={18} aria-hidden="true" />
            Written guides
          </Link>
        </p>
      </header>

      <div className={styles.stage}>
        <div className={styles.playerColumn} ref={playerRef}>
          <TeacherVideoFrame key={current.id} video={current} startPlaying={pickedId === current.id} />
          <div className={styles.nowPlaying}>
            <h2 className={styles.nowTitle}>{current.title}</h2>
            <p className={styles.nowMeta}>
              {duration && <span>{duration}</span>}
              {current.guideSlug && (
                <Link to={`/help/${current.guideSlug}`} className={styles.textLink}>
                  Read the step-by-step guide
                </Link>
              )}
            </p>
          </div>
        </div>

        <nav className={styles.chapters} aria-label="Videos by task">
          {TEACHER_VIDEO_GROUPS.map((group) => (
            <section key={group.key} className={styles.group} aria-labelledby={`group-${group.key}`}>
              <h3 id={`group-${group.key}`} className={styles.groupTitle}>
                {group.title}
              </h3>
              <ul className={styles.list}>
                {group.videos.map((video) => {
                  const active = video.id === current.id;
                  return (
                    <li key={video.id}>
                      <button
                        type="button"
                        className={`${styles.item} ${active ? styles.itemActive : ""}`.trim()}
                        aria-current={active ? "true" : undefined}
                        onClick={() => pick(video)}
                      >
                        <ListThumb video={video} />
                        <span className={styles.itemBody}>
                          <span className={styles.itemTitle}>{video.title}</span>
                          {video.durationSeconds > 0 && (
                            <span className={styles.itemMeta}>{formatVideoDuration(video.durationSeconds)}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
      </div>

      <TeacherCtaBanner className={styles.cta} />
    </div>
  );
}
