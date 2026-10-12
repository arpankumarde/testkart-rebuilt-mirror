import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Megaphone, Heart, Trash2, ImagePlus, X, Users, Sparkles } from "lucide-react";
import { useTeacherPostsQuery, useCreateTeacherPostMutation, useDeleteTeacherPostMutation } from "../helpers/useTeacherPosts";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { TeacherListEmpty } from "../components/TeacherListEmpty";
import { Button } from "../components/Button";
import { Textarea } from "../components/Textarea";
import { Skeleton } from "../components/Skeleton";
import { uploadFileToR2, deleteR2File } from "../helpers/useR2Upload";
import styles from "./teacher.posts.module.css";

const MAX_BODY_LENGTH = 2000;
const MAX_IMAGE_SIZE_MB = 2;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const TeacherPostsPage: React.FC = () => {
  const { data, isFetching, isError, error } = useTeacherPostsQuery();
  const createMutation = useCreateTeacherPostMutation();
  const deleteMutation = useDeleteTeacherPostMutation();

  const [body, setBody] = useState("");
  const [image, setImage] = useState<{ url: string; fileId: string } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setFormError(`Image must be under ${MAX_IMAGE_SIZE_MB}MB.`);
      return;
    }

    setFormError(null);
    setIsUploadingImage(true);
    try {
      const result = await uploadFileToR2(file, "teacher-posts", file.name);
      setImage({ url: result.url, fileId: result.key });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (image) {
      try {
        await deleteR2File(image.fileId);
      } catch {
        // Best-effort cleanup only; the post simply won't reference it.
      }
    }
    setImage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      setFormError("Write something before posting.");
      return;
    }
    setFormError(null);
    try {
      await createMutation.mutateAsync({
        body: trimmed,
        imageUrl: image?.url ?? null,
        imageFileId: image?.fileId ?? null,
      });
      setBody("");
      setImage(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not publish post.");
    }
  };

  const posts = data?.posts ?? [];

  return (
    <>
      <Helmet>
        <title>Community Posts - Testkart for Teachers</title>
        <meta name="description" content="Share updates with the students who follow you." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Community Posts" />

        <div className={styles.layout}>
          <div className={styles.main}>
            <form className={styles.composer} onSubmit={handleSubmit}>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY_LENGTH))}
                placeholder="Share an update with your followers..."
                rows={4}
                className={styles.textarea}
              />
              <div className={styles.composerFooter}>
                <div className={styles.composerLeft}>
                  <label className={styles.imageButton}>
                    <ImagePlus size={16} aria-hidden="true" />
                    {isUploadingImage ? "Uploading..." : "Add image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleImagePick}
                      disabled={isUploadingImage}
                      className={styles.hiddenInput}
                    />
                  </label>
                  <span className={styles.charCount}>
                    {body.length}/{MAX_BODY_LENGTH}
                  </span>
                </div>
                <Button
                  type="submit"
                  className={styles.postButton}
                  disabled={createMutation.isPending || isUploadingImage || !body.trim()}
                >
                  {createMutation.isPending ? "Posting..." : "Post"}
                </Button>
              </div>

              {image && (
                <div className={styles.imagePreview}>
                  <img src={image.url} alt="" />
                  <button type="button" className={styles.removeImage} onClick={handleRemoveImage} aria-label="Remove image">
                    <X size={14} />
                  </button>
                </div>
              )}

              {formError && <p className={styles.formError} role="alert">{formError}</p>}
            </form>

            {isFetching && !data && (
              <div className={styles.list}>
                <Skeleton style={{ height: "6rem", borderRadius: "1.25rem" }} />
                <Skeleton style={{ height: "6rem", borderRadius: "1.25rem" }} />
              </div>
            )}

            {isError && (
              <TeacherListEmpty
                tone="error"
                title="Could not load your posts"
                description={error instanceof Error ? error.message : "Try refreshing the page."}
              />
            )}

            {!isFetching && !isError && posts.length === 0 && (
              <TeacherListEmpty
                icon={<Megaphone size={24} />}
                title="No community posts yet"
                description="Once you post an update, it will show here and on your public profile for your followers."
              />
            )}

            {posts.length > 0 && (
              <ul className={styles.list}>
                {posts.map((post) => (
                  <li key={post.id} className={styles.post}>
                    <p className={styles.postBody}>{post.body}</p>
                    {post.imageUrl && <img src={post.imageUrl} alt="" className={styles.postImage} />}
                    <div className={styles.postFooter}>
                      <span className={styles.postMeta}>{formatDate(post.createdAt)}</span>
                      <span className={styles.postMeta}>
                        <Heart size={14} aria-hidden="true" /> {post.likeCount}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => deleteMutation.mutate(post.id)}
                        disabled={deleteMutation.isPending}
                        aria-label="Delete post"
                        className={styles.deleteButton}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside className={styles.sidebar} aria-label="Community stats and tips">
            <div className={styles.statCard}>
              <span className={styles.statIcon} aria-hidden="true">
                <Users size={18} />
              </span>
              <div>
                <span className={styles.statValue}>{data ? data.followerCount : "-"}</span>
                <span className={styles.statLabel}>{data?.followerCount === 1 ? "Follower" : "Followers"}</span>
              </div>
            </div>

            <div className={styles.tipCard}>
              <span className={styles.tipIcon} aria-hidden="true">
                <Sparkles size={16} />
              </span>
              <p>
                Community posts show up on your public profile for everyone to read. Only the students who
                follow you need to sign in - and only to like a post, nothing more for now.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
};

export default TeacherPostsPage;
