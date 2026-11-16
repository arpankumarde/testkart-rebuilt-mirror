/**
 * Image size rule for the Blog and Exam News editors. Free of server imports, so the editors
 * and the upload size check share one limit.
 */

export const BLOG_NEWS_IMAGE_MAX_MB = 1;

export const BLOG_IMAGE_FOLDER = "platform/blog-images";
export const EXAM_NEWS_IMAGE_FOLDER = "platform/exam-news";
export const BLOG_EDITOR_IMAGE_FOLDER = "editor-images/blog";
export const EXAM_NEWS_EDITOR_IMAGE_FOLDER = "editor-images/exam-news";

const BLOG_NEWS_FOLDERS = [
  BLOG_IMAGE_FOLDER,
  EXAM_NEWS_IMAGE_FOLDER,
  BLOG_EDITOR_IMAGE_FOLDER,
  EXAM_NEWS_EDITOR_IMAGE_FOLDER,
];

export function isBlogNewsImageFolder(folder: string): boolean {
  const normalized = folder.replace(/^\/+/, "").replace(/\/+$/, "");
  return BLOG_NEWS_FOLDERS.some((name) => normalized === name || normalized.startsWith(`${name}/`));
}

export const BLOG_NEWS_IMAGE_TOO_LARGE_MESSAGE = `Blog and exam news images must be ${BLOG_NEWS_IMAGE_MAX_MB} MB or smaller. Compress or resize the image and try again.`;
