import React, { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { Languages, Link2, Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './DropdownMenu';
import { uploadFileToR2 } from '../helpers/useR2Upload';
import { useUploadLimits } from '../helpers/useUploadLimits';
import {
  DEFAULT_VIDEO_LANGUAGE,
  MAX_VIDEO_LANGUAGE_LENGTH,
  VIDEO_LANGUAGE_OPTIONS,
  YOUTUBE_EMBED_ALLOW,
  normalizeLanguageVideos,
  parseVideoLink,
  type LanguageVideo,
  type LanguageVideoKind,
} from '../helpers/languageVideo';
import styles from './LanguageVideoNodeView.module.css';

/** Editor view of a language video block: a tab per language, each with its own language name and upload or link. */
export const LanguageVideoNodeView = ({ node, updateAttributes, deleteNode, selected }: ReactNodeViewProps) => {
  const limits = useUploadLimits();
  const stored = normalizeLanguageVideos(node.attrs.videos);
  const videos: LanguageVideo[] = stored.length > 0 ? stored : [{ language: DEFAULT_VIDEO_LANGUAGE, kind: 'file', src: '' }];

  const [activeLanguage, setActiveLanguage] = useState(videos[0].language);
  const [uploadingLanguage, setUploadingLanguage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);
  // An upload can finish after other edits to this block, so writes start from the latest list.
  const videosRef = useRef(videos);
  videosRef.current = videos;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const active = videos.find((video) => video.language === activeLanguage) ?? videos[0];
  const usedLanguages = new Set(videos.map((video) => video.language.toLowerCase()));
  const availableLanguages = VIDEO_LANGUAGE_OPTIONS.filter((language) => !usedLanguages.has(language.toLowerCase()));

  const saveVideos = (next: LanguageVideo[]) => updateAttributes({ videos: next });

  const setVideo = (language: string, kind: LanguageVideoKind, src: string) => {
    saveVideos(videosRef.current.map((video) => (video.language === language ? { ...video, kind, src } : video)));
  };

  const addLanguage = (language: string) => {
    const entry: LanguageVideo = { language, kind: 'file', src: '' };
    const current = videosRef.current;
    saveVideos(language === DEFAULT_VIDEO_LANGUAGE ? [entry, ...current] : [...current, entry]);
    setActiveLanguage(language);
  };

  // Hindi always leads, so a tab changed to Hindi moves to the front; any other change keeps its place.
  const changeLanguage = (from: string, to: string) => {
    const current = videosRef.current;
    const entry = current.find((video) => video.language === from);
    if (!entry || from === to) return;
    const changed: LanguageVideo = { ...entry, language: to };
    saveVideos(
      to === DEFAULT_VIDEO_LANGUAGE
        ? [changed, ...current.filter((video) => video !== entry)]
        : current.map((video) => (video === entry ? changed : video))
    );
    setActiveLanguage(to);
  };

  // Typed names take the list's spelling when they match one. `current` is the tab being renamed, if any.
  const promptLanguage = (current?: string): string | null => {
    const input = window.prompt('Which language is this video in?', current ?? '');
    if (input === null) return null;
    const typed = input.trim().replace(/\s+/g, ' ');
    if (!typed) return null;
    if (typed.length > MAX_VIDEO_LANGUAGE_LENGTH) {
      toast.error(`Keep the language name under ${MAX_VIDEO_LANGUAGE_LENGTH} characters`);
      return null;
    }
    const taken = videosRef.current.find(
      (video) => video.language !== current && video.language.toLowerCase() === typed.toLowerCase()
    );
    if (taken) {
      toast.error(`${taken.language} is already added`);
      return null;
    }
    return VIDEO_LANGUAGE_OPTIONS.find((language) => language.toLowerCase() === typed.toLowerCase()) ?? typed;
  };

  const addOtherLanguage = () => {
    const language = promptLanguage();
    if (language) addLanguage(language);
  };

  const changeToOtherLanguage = (from: string) => {
    const language = promptLanguage(from);
    if (language) changeLanguage(from, language);
  };

  const removeLanguage = (language: string) => {
    const current = videosRef.current;
    const remaining = current.filter((video) => video.language !== language);
    if (remaining.length === 0) return;
    const hasVideo = current.some((video) => video.language === language && video.src);
    if (hasVideo && !window.confirm(`Remove the ${language} video?`)) return;
    saveVideos(remaining);
    setActiveLanguage(remaining[0].language);
  };

  const pasteLink = (language: string) => {
    const input = window.prompt(`Paste the ${language} video link. YouTube links and direct links to MP4, WebM or Ogg files work.`);
    if (input === null || !input.trim()) return;
    const link = parseVideoLink(input);
    if (!link.ok) {
      toast.error(link.message);
      return;
    }
    setVideo(language, link.kind, link.src);
  };

  const pickFile = (language: string) => {
    uploadTargetRef.current = language;
    fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const language = uploadTargetRef.current;
    if (!file || !language) return;
    if (!file.type.startsWith('video/')) {
      toast.error('Please upload a valid video file');
      return;
    }
    if (file.size > limits.lessonVideoMaxMb * 1024 * 1024) {
      toast.error(`Video size must be less than ${limits.lessonVideoMaxMb}MB`);
      return;
    }

    setUploadingLanguage(language);
    try {
      const result = await uploadFileToR2(file, 'editor-videos');
      if (!mountedRef.current) return;
      setVideo(language, 'file', result.url);
      toast.success(`${language} video uploaded`);
    } catch (err) {
      console.error('Video upload error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to upload video');
    } finally {
      if (mountedRef.current) setUploadingLanguage(null);
    }
  };

  const isUploadingActive = uploadingLanguage === active.language;

  return (
    <NodeViewWrapper className={`${styles.block} ${selected ? styles.selected : ''}`}>
      <div className={styles.header}>
        <span className={styles.title}>
          <Languages size={16} aria-hidden="true" /> Video languages
        </span>
        <Button type="button" size="sm" variant="ghost" className={styles.removeBlock} onClick={() => deleteNode()}>
          <Trash2 size={14} /> Remove block
        </Button>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Video language">
        {videos.map((video) => {
          const isActive = video.language === active.language;
          return (
            <button
              key={video.language}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => setActiveLanguage(video.language)}
            >
              {video.language}
              {uploadingLanguage === video.language ? (
                <Loader2 size={12} className={styles.spinning} aria-label="Uploading" />
              ) : (
                !video.src && <span className={styles.tabNote}>(no video)</span>
              )}
            </button>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="outline">
              <Plus size={14} /> Add language
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {availableLanguages.map((language) => (
              <DropdownMenuItem key={language} onSelect={() => addLanguage(language)}>
                {language}
              </DropdownMenuItem>
            ))}
            {availableLanguages.length > 0 && <DropdownMenuSeparator />}
            {/* After the menu closes, so the prompt does not fight the menu for focus */}
            <DropdownMenuItem onSelect={() => window.setTimeout(addOtherLanguage, 0)}>Other language...</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={styles.panel} role="tabpanel" aria-label={`${active.language} video`}>
        {active.src ? (
          active.kind === 'youtube' ? (
            <iframe
              key={active.src}
              className={styles.media}
              src={active.src}
              title={`${active.language} video`}
              allow={YOUTUBE_EMBED_ALLOW}
              allowFullScreen
            />
          ) : (
            <video key={active.src} className={styles.media} src={active.src} controls preload="metadata" playsInline />
          )
        ) : (
          <div className={styles.empty}>
            <strong>No {active.language} video yet</strong>
            <span>Upload a video or paste a link. Readers only see languages that have a video.</span>
          </div>
        )}

        <div className={styles.actions}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => pickFile(active.language)}
            disabled={uploadingLanguage !== null}
          >
            {isUploadingActive ? <Loader2 size={14} className={styles.spinning} /> : <Upload size={14} />}
            {isUploadingActive ? 'Uploading...' : active.src ? 'Replace with upload' : 'Upload video'}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => pasteLink(active.language)} disabled={isUploadingActive}>
            <Link2 size={14} /> {active.src ? 'Replace with link' : 'Paste link'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline" disabled={isUploadingActive}>
                <Pencil size={14} /> Change language
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {availableLanguages.map((language) => (
                <DropdownMenuItem key={language} onSelect={() => changeLanguage(active.language, language)}>
                  {language}
                </DropdownMenuItem>
              ))}
              {availableLanguages.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={() => window.setTimeout(() => changeToOtherLanguage(active.language), 0)}>
                Other language...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {videos.length > 1 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={styles.removeLanguage}
              onClick={() => removeLanguage(active.language)}
              disabled={isUploadingActive}
            >
              <Trash2 size={14} /> Remove {active.language}
            </Button>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="video/*" className={styles.fileInput} onChange={handleFile} />
    </NodeViewWrapper>
  );
};