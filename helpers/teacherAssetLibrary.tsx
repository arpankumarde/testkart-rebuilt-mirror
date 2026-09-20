import { sql } from "kysely";
import { db } from "./db";
import { R2_PUBLIC_URL } from "./_publicConfigs";
import type { TeacherAsset, TeacherAssetKindValue } from "./teacherAssetFiles";

/*
 * Server side of the teacher asset library. A library row points at an R2 object
 * the teacher owns. Rows are added by library uploads (teacher/assets/create) and
 * by syncTeacherAssetsFromContent, which picks up course lesson videos/PDFs and
 * study notes PDFs the teacher uploaded through the older per-item uploaders.
 * teacher_assets is listed in r2FileOwnership's reference columns, so deleting a
 * lesson or product keeps a file that is still in the library.
 */

const CDN_PREFIX = `https://${R2_PUBLIC_URL}/`;

export async function syncTeacherAssetsFromContent(teacherId: number): Promise<void> {
  const keyStart = CDN_PREFIX.length + 1;
  const cdnPattern = `${CDN_PREFIX}%`;
  await sql`
    INSERT INTO teacher_assets
      (teacher_id, key, url, name, kind, mime_type, size_bytes, duration_seconds, created_at, updated_at)
    SELECT DISTINCT ON (src.key)
      ${teacherId}, src.key, src.url, src.name, src.kind::teacher_asset_kind, src.mime_type,
      src.size_bytes, src.duration_seconds, src.created_at, src.created_at
    FROM (
      SELECT
        split_part(substr(l.content_url, ${keyStart}), '?', 1) AS key,
        l.content_url AS url,
        left(l.title, 200) AS name,
        l.content_type::text AS kind,
        CASE WHEN l.content_type = 'pdf' THEN 'application/pdf' END AS mime_type,
        NULL::bigint AS size_bytes,
        CASE WHEN l.duration_minutes > 0 THEN l.duration_minutes * 60 END AS duration_seconds,
        l.created_at AS created_at
      FROM course_lessons l
      JOIN course_sections s ON s.id = l.section_id
      JOIN courses c ON c.id = s.course_id
      WHERE c.teacher_id = ${teacherId}
        AND l.content_type IN ('video', 'pdf')
        AND l.content_url LIKE ${cdnPattern}
      UNION ALL
      SELECT
        split_part(substr(f.file_url, ${keyStart}), '?', 1),
        f.file_url,
        left(coalesce(nullif(trim(f.title), ''), p.title), 200),
        'pdf',
        'application/pdf',
        f.file_size_bytes,
        NULL::integer,
        f.created_at
      FROM digital_product_files f
      JOIN digital_products p ON p.id = f.product_id
      WHERE p.teacher_id = ${teacherId}
        AND f.file_url LIKE ${cdnPattern}
    ) src
    WHERE src.key <> ''
    ORDER BY src.key, src.created_at
    ON CONFLICT (teacher_id, key) DO NOTHING
  `.execute(db);
}

type AssetRow = {
  id: number;
  key: string;
  url: string;
  name: string;
  kind: TeacherAssetKindValue;
  mimeType: string | null;
  sizeBytes: string | null;
  durationSeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
  lessonCount: number;
  notesCount: number;
};

const toAsset = (row: AssetRow): TeacherAsset => ({
  ...row,
  sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
  lessonCount: Number(row.lessonCount),
  notesCount: Number(row.notesCount),
});

/** The teacher's library, newest first, each item with how many lessons and notes use it. */
export async function listTeacherAssets(teacherId: number, assetId?: number): Promise<TeacherAsset[]> {
  const result = await sql<AssetRow>`
    WITH lesson_use AS (
      SELECT l.content_url AS url, count(*)::int AS n
      FROM course_lessons l
      JOIN course_sections s ON s.id = l.section_id
      JOIN courses c ON c.id = s.course_id
      WHERE c.teacher_id = ${teacherId}
        AND l.content_type IN ('video', 'pdf')
        AND l.content_url IS NOT NULL
      GROUP BY l.content_url
    ),
    notes_use AS (
      SELECT f.file_url AS url, count(DISTINCT f.product_id)::int AS n
      FROM digital_product_files f
      JOIN digital_products p ON p.id = f.product_id
      WHERE p.teacher_id = ${teacherId}
      GROUP BY f.file_url
    )
    SELECT
      a.id, a.key, a.url, a.name, a.kind::text AS kind,
      a.mime_type AS "mimeType",
      a.size_bytes::text AS "sizeBytes",
      a.duration_seconds AS "durationSeconds",
      a.created_at AS "createdAt",
      a.updated_at AS "updatedAt",
      coalesce(lu.n, 0) AS "lessonCount",
      coalesce(nu.n, 0) AS "notesCount"
    FROM teacher_assets a
    LEFT JOIN lesson_use lu ON lu.url = a.url
    LEFT JOIN notes_use nu ON nu.url = a.url
    WHERE a.teacher_id = ${teacherId}
      ${assetId === undefined ? sql`` : sql`AND a.id = ${assetId}`}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT 5000
  `.execute(db);
  return result.rows.map(toAsset);
}