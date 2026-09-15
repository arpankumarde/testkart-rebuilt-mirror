import React, { useState, useEffect, useRef } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, PlayCircle, FileText, Lock, X, AlertCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './Dialog';
import { wrapContentTables } from '../helpers/contentTables';
import { sanitizeHtml } from '../helpers/sanitizeHtml';
import styles from './CourseCurriculum.module.css';

const CoursePDFPreview = React.lazy(() => import('./CoursePDFPreview').then(m => ({ default: m.CoursePDFPreview })));

// These types would be imported from a public course details endpoint schema
type Lesson = {
  id: number;
  title: string;
  contentType: 'video' | 'text' | 'quiz' | 'pdf';
  durationMinutes: number | null;
  isPreview: boolean;
  contentUrl?: string | null; // For video/pdf preview
  textContent?: string | null; // For text content preview
};

type Section = {
  id: number;
  title: string;
  lessons: Lesson[];
};

interface CourseCurriculumProps {
  sections: Section[];
  className?: string;
}

// Helper function to check if URL is a YouTube URL
const isYouTubeUrl = (url: string): boolean => {
  return url.includes('youtube.com') || url.includes('youtu.be');
};

// Helper function to extract YouTube video ID
const extractYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
};

// Helper function to check if URL is an image URL
const isImageUrl = (url: string): boolean => {
  if (!url) return false;
  const cleanUrl = url.toLowerCase().split('?')[0].split('#')[0];
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(ext => cleanUrl.endsWith(ext));
};

// Helper function to convert YouTube URL to embed URL
const convertToYouTubeEmbed = (url: string): string | null => {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;
  const params = ['playsinline=1', 'rel=0', 'autoplay=1'];
  const queryString = '?' + params.join('&');
  return `https://www.youtube-nocookie.com/embed/${videoId}${queryString}`;
};

const LessonIcon = ({ type }: { type: Lesson['contentType'] }) => {
  switch (type) {
    case 'video':
      return <PlayCircle size={16} />;
    case 'text':
      return <FileText size={16} />;
    // Add other cases for quiz, pdf etc. when available
    default:
      return <FileText size={16} />;
  }
};

export const CourseCurriculum: React.FC<CourseCurriculumProps> = ({ sections, className }) => {
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null);

  const totalSections = sections.length;
  const totalLessons = sections.reduce((acc, section) => acc + section.lessons.length, 0);
  const totalDurationMinutes = sections.reduce((total, section) => {
    const sectionDuration = section.lessons.reduce((acc, lesson) => acc + (lesson.durationMinutes || 0), 0);
    return total + sectionDuration;
  }, 0);

  const defaultExpanded = sections.map(s => s.id.toString());

  const handlePreviewClick = (lesson: Lesson) => {
    if (lesson.isPreview) {
      setPreviewLesson(lesson);
    }
  };

  // Check if the preview lesson has a YouTube URL
  const isYouTubePreview = previewLesson?.contentType === 'video' && 
                            previewLesson.contentUrl && 
                            isYouTubeUrl(previewLesson.contentUrl);
  const youtubeEmbedUrl = isYouTubePreview && previewLesson?.contentUrl
    ? convertToYouTubeEmbed(previewLesson.contentUrl)
    : null;

  return (
    <div className={`${styles.curriculum} ${className || ''}`}>
      <h2 className={styles.title}>Course Curriculum</h2>
      <div className={styles.summary}>
        <span>{totalSections} sections</span>
        <span className={styles.dot}>•</span>
        <span>{totalLessons} lessons</span>
        {totalDurationMinutes > 0 && (
          <>
            <span className={styles.dot}>•</span>
            <span>{Math.round(totalDurationMinutes / 60)}h {totalDurationMinutes % 60}m total length</span>
          </>
        )}
      </div>

      <Accordion.Root
        type="multiple"
        defaultValue={defaultExpanded}
        className={styles.accordionRoot}
      >
        {sections.map((section) => (
          <Accordion.Item key={section.id} value={section.id.toString()} className={styles.accordionItem}>
            <Accordion.Header className={styles.accordionHeader}>
              <Accordion.Trigger className={styles.accordionTrigger}>
                <span className={styles.sectionTitle}>{section.title}</span>
                <div className={styles.sectionMeta}>
                  <span>{section.lessons.length} lessons</span>
                  <ChevronDown className={styles.accordionChevron} aria-hidden />
                </div>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className={styles.accordionContent}>
              <ul className={styles.lessonList}>
                {section.lessons.map((lesson) => (
                  <li
                    key={lesson.id}
                    className={`${styles.lessonItem} ${lesson.isPreview ? styles.lessonItemClickable : ''}`}
                    onClick={() => handlePreviewClick(lesson)}
                  >
                    <div className={styles.lessonInfo}>
                      <LessonIcon type={lesson.contentType} />
                      <span className={styles.lessonTitle}>{lesson.title}</span>
                    </div>
                    <div className={styles.lessonMeta}>
                      {lesson.isPreview && (
                        <span className={styles.previewBadge}>Preview</span>
                      )}
                      {!lesson.isPreview && (
                        <Lock size={14} className={styles.lockIcon} />
                      )}
                      {lesson.durationMinutes && (
                        <span className={styles.duration}>{lesson.durationMinutes}m</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>

      <Dialog open={!!previewLesson} onOpenChange={(open) => !open && setPreviewLesson(null)}>
        <DialogContent className={styles.previewDialog}>
          <DialogHeader>
            <DialogTitle>{previewLesson?.title}</DialogTitle>
          </DialogHeader>
          <div className={styles.previewContent}>
            {previewLesson?.contentType === 'video' && previewLesson.contentUrl && (
              <>
                {isYouTubePreview && youtubeEmbedUrl ? (
                  <div className={styles.youtubeContainer}>
                    <iframe
                      src={youtubeEmbedUrl}
                      className={styles.youtubeIframe}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
                      allowFullScreen
                      title={previewLesson.title}
                    />
                  </div>
                ) : (
                  <div className={styles.videoContainer}>
                    <video
                      controls
                      autoPlay
                      className={styles.videoPlayer}
                      src={previewLesson.contentUrl}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                )}
              </>
            )}
            {previewLesson?.contentType === 'text' && previewLesson.textContent && (
              <div className={styles.textContent}>
                <div dangerouslySetInnerHTML={{ __html: wrapContentTables(sanitizeHtml(previewLesson.textContent)) }} />
              </div>
            )}
            {previewLesson?.contentType === 'pdf' && previewLesson.contentUrl && (
              isImageUrl(previewLesson.contentUrl) ? (
                <div className={styles.imageContainer}>
                  <img src={previewLesson.contentUrl} alt={previewLesson.title} className={styles.previewImage} />
                </div>
              ) : (
                <React.Suspense fallback={<div>Loading PDF viewer...</div>}>
                  <CoursePDFPreview url={previewLesson.contentUrl} />
                </React.Suspense>
              )
            )}
            {!previewLesson?.contentUrl && !previewLesson?.textContent && (
              <div className={styles.noPreview}>
                <p>Preview content is not available for this lesson.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};