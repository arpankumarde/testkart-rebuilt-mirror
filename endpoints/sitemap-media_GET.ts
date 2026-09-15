import { db } from "../helpers/db";
import {
  getIndexableMockTestIds,
  getIndexableStudyNoteIds,
  getIndexableCourseIds,
  getIndexableBundleIds,
} from "../helpers/fetchIndexableUgcIds";

const BASE_URL = "https://testkart.in";

type ImageEntry = { loc: string; title?: string | null };
type VideoEntry = {
  thumbnailLoc: string;
  title: string;
  description: string;
  contentLoc: string;
};
type MediaUrlEntry = {
  loc: string;
  images: ImageEntry[];
  videos: VideoEntry[];
};

// Minimal XML-escaping for free-text fields (titles/descriptions) — URLs in
// this dataset are already URL-safe slugs/CDN paths so they're not escaped,
// but titles/descriptions come from admin/teacher-authored text and can
// contain &, <, >, quotes, etc.
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderEntry(entry: MediaUrlEntry): string {
  const imageBlocks = entry.images
    .map(
      (img) => `
    <image:image>
      <image:loc>${img.loc}</image:loc>${
        img.title ? `\n      <image:title>${escapeXml(img.title)}</image:title>` : ""
      }
    </image:image>`
    )
    .join("");

  const videoBlocks = entry.videos
    .map(
      (v) => `
    <video:video>
      <video:thumbnail_loc>${v.thumbnailLoc}</video:thumbnail_loc>
      <video:title>${escapeXml(v.title)}</video:title>
      <video:description>${escapeXml(v.description)}</video:description>
      <video:content_loc>${v.contentLoc}</video:content_loc>
    </video:video>`
    )
    .join("");

  return `
  <url>
    <loc>${entry.loc}</loc>${imageBlocks}${videoBlocks}
  </url>`;
}

export async function handle(request: Request) {
  try {
    // Only currently-indexable UGC rows get a media sitemap entry, same as
    // the main sitemap — see helpers/fetchIndexableUgcIds.tsx.
    const [
      indexableMockTestIds,
      indexableCourseIds,
      indexableStudyNoteIds,
      indexableBundleIds,
    ] = await Promise.all([
      getIndexableMockTestIds(),
      getIndexableCourseIds(),
      getIndexableStudyNoteIds(),
      getIndexableBundleIds(),
    ]);

    const [mockTests, courses, digitalProducts, bundles, blogPosts] = await Promise.all([
      indexableMockTestIds.size > 0
        ? db
            .selectFrom("mockTests")
            .where("mockTests.id", "in", Array.from(indexableMockTestIds))
            .select(["mockTests.slug", "mockTests.title", "mockTests.thumbnailUrl", "mockTests.introVideoUrl"])
            .execute()
        : Promise.resolve([]),
      indexableCourseIds.size > 0
        ? db
            .selectFrom("courses")
            .where("courses.id", "in", Array.from(indexableCourseIds))
            .select([
              "courses.slug",
              "courses.title",
              "courses.thumbnailUrl",
              "courses.thumbnailImageUrl",
              "courses.introVideoUrl",
            ])
            .execute()
        : Promise.resolve([]),
      indexableStudyNoteIds.size > 0
        ? db
            .selectFrom("digitalProducts")
            .where("digitalProducts.id", "in", Array.from(indexableStudyNoteIds))
            .select(["digitalProducts.slug", "digitalProducts.title", "digitalProducts.thumbnailUrl"])
            .execute()
        : Promise.resolve([]),
      indexableBundleIds.size > 0
        ? db
            .selectFrom("courseBundles")
            .where("courseBundles.id", "in", Array.from(indexableBundleIds))
            .select([
              "courseBundles.slug",
              "courseBundles.title",
              "courseBundles.thumbnailUrl",
              "courseBundles.introVideoUrl",
            ])
            .execute()
        : Promise.resolve([]),
      db
        .selectFrom("blogPosts")
        .where("status", "=", "published")
        .select(["slug", "type", "title", "featuredImage"])
        .execute(),
    ]);

    const entries: MediaUrlEntry[] = [];

    // Mock tests — thumbnail image, plus intro video if present (reusing
    // the same thumbnail as the video's required thumbnail_loc).
    for (const test of mockTests) {
      if (!test.slug || (!test.thumbnailUrl && !test.introVideoUrl)) continue;
      const loc = `${BASE_URL}/mock-test/${test.slug}`;
      const images: ImageEntry[] = test.thumbnailUrl ? [{ loc: test.thumbnailUrl, title: test.title }] : [];
      const videos: VideoEntry[] =
        test.introVideoUrl && test.thumbnailUrl
          ? [
              {
                thumbnailLoc: test.thumbnailUrl,
                title: test.title,
                description: `Preview video for the ${test.title} mock test on Testkart.`,
                contentLoc: test.introVideoUrl,
              },
            ]
          : [];
      if (images.length > 0 || videos.length > 0) entries.push({ loc, images, videos });
    }

    // Courses — prefer thumbnailImageUrl over thumbnailUrl, matching the
    // fallback order used everywhere else courses render a thumbnail.
    for (const course of courses) {
      const thumbnail = course.thumbnailImageUrl || course.thumbnailUrl;
      if (!course.slug || (!thumbnail && !course.introVideoUrl)) continue;
      const loc = `${BASE_URL}/course/${course.slug}`;
      const images: ImageEntry[] = thumbnail ? [{ loc: thumbnail, title: course.title }] : [];
      const videos: VideoEntry[] =
        course.introVideoUrl && thumbnail
          ? [
              {
                thumbnailLoc: thumbnail,
                title: course.title,
                description: `Preview video for the ${course.title} course on Testkart.`,
                contentLoc: course.introVideoUrl,
              },
            ]
          : [];
      if (images.length > 0 || videos.length > 0) entries.push({ loc, images, videos });
    }

    // Study notes (digital products) — thumbnail image only, no video field.
    for (const product of digitalProducts) {
      if (!product.slug || !product.thumbnailUrl) continue;
      entries.push({
        loc: `${BASE_URL}/study-notes/${product.slug}`,
        images: [{ loc: product.thumbnailUrl, title: product.title }],
        videos: [],
      });
    }

    // Bundles — thumbnail image, plus intro video if present.
    for (const bundle of bundles) {
      if (!bundle.slug || (!bundle.thumbnailUrl && !bundle.introVideoUrl)) continue;
      const loc = `${BASE_URL}/bundles/${bundle.slug}`;
      const images: ImageEntry[] = bundle.thumbnailUrl ? [{ loc: bundle.thumbnailUrl, title: bundle.title }] : [];
      const videos: VideoEntry[] =
        bundle.introVideoUrl && bundle.thumbnailUrl
          ? [
              {
                thumbnailLoc: bundle.thumbnailUrl,
                title: bundle.title,
                description: `Preview video for the ${bundle.title} bundle on Testkart.`,
                contentLoc: bundle.introVideoUrl,
              },
            ]
          : [];
      if (images.length > 0 || videos.length > 0) entries.push({ loc, images, videos });
    }

    // Blog and knowledge base posts — featured image only.
    for (const post of blogPosts) {
      if (!post.slug || !post.featuredImage) continue;
      const path = post.type === "knowledge_base" ? "help" : "blog";
      entries.push({
        loc: `${BASE_URL}/${path}/${post.slug}`,
        images: [{ loc: post.featuredImage, title: post.title }],
        videos: [],
      });
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">`;

    for (const entry of entries) {
      xml += renderEntry(entry);
    }

    xml += `
</urlset>`;

    return new Response(xml.trim(), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        // Same indexability computation as sitemap_GET.ts, run a second
        // time for the media variant — caching at the edge is what keeps
        // this fast at 10x catalog size. See sitemap_GET.ts for the full
        // rationale.
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
      status: 200,
    });
  } catch (error) {
    console.error("Failed to generate media sitemap:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(`Error generating media sitemap: ${message}`, {
      status: 500,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }
}
