import React, { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpen, Youtube } from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import { BookDemoButton } from "../components/BookDemoButton";
import { TeacherVideoFrame } from "../components/TeacherVideoFrame";
import { JoinTestkart } from "../components/JoinTestkart";
import { R2_PUBLIC_URL } from "../helpers/_publicConfigs";
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

/** The Book-a-demo dialog's own artwork, so the hero and the dialog read as one ask. 400x300, transparent. */
const HERO_ART_URL = `https://${R2_PUBLIC_URL}/marketing-assets/home-demo-cta-popup.png`;

const ListThumb = ({ video }: { video: TeacherVideo }) =>
  video.source === "youtube" ? (
    <img
      src={`https://i.ytimg.com/vi/${video.id}/sddefault.jpg`}
      alt=""
      width={640}
      height={480}
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
    <div className={styles.root}>
      <SEOHead
        title="Teacher video walkthroughs"
        description="Book a free 15-minute demo with the Testkart team, or watch short videos that show teachers how to create and sell mock tests, live tests, notes, PDFs and courses, and how to get paid."
      />

      <section className={styles.hero} aria-labelledby="demo-hero-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <h1 id="demo-hero-title" className={styles.heroTitle}>
              Book a free demo
            </h1>
            <p className={styles.heroLead}>
              A 15-minute call with our team, at a time you pick. We show you how to sell your tests, notes and courses
              on Testkart.
            </p>
            <BookDemoButton size="lg" variant="primary" withIcon={false} className={styles.heroCta}>
              Book a free demo
            </BookDemoButton>
            <a href="#videos" className={styles.heroLink}>
              Or watch the videos first
            </a>
          </div>
          <img
            src={HERO_ART_URL}
            alt=""
            width={400}
            height={300}
            loading="lazy"
            decoding="async"
            className={styles.heroArt}
          />
        </div>
      </section>

      <div className={styles.page}>
        <header className={styles.intro} id="videos">
          <h2 className={styles.title}>Watch how Testkart works</h2>
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
              <h3 className={styles.nowTitle}>{current.title}</h3>
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
      </div>

      <JoinTestkart audience="teacher" />
    </div>
  );
}
