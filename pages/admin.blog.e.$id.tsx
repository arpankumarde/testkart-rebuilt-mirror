import React, { useState, useEffect, useRef, useCallback } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  useAdminBlogPostQuery,
  useAdminBlogCategoriesQuery,
  useUpsertBlogPostMutation,
  useAutoSaveBlogPostMutation
} from "../helpers/useAdminBlog";
import { schema as upsertPostSchema } from "../endpoints/admin/blog/posts/upsert_POST.schema";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/Select";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { Switch } from "../components/Switch";
import { RichTextEditor } from "../components/RichTextEditor";
import { ImageUploader } from "../components/ImageUploader";
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from "../components/Form";
import { ArrowLeft, Newspaper, BookOpen, Check, Loader2, X } from "lucide-react";
import { useAdminLayout } from "../helpers/useAdminLayout";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { useAdminOptionsQuery } from "../helpers/useAdminOptions";
import { slugify } from "../helpers/slugify";
import styles from "./admin.blog.e.$id.module.css";

const deriveSlug = (values: { title?: string; seoTitle?: string | null }) =>
  slugify(values.title || values.seoTitle || "");

const AdminBlogEditorPage = () => {
  const { id: idSegment } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const idParam = idSegment && idSegment !== 'new' ? idSegment : null;
  const typeParam = searchParams.get('type');
  
  const [postId, setPostId] = useState<number | undefined>(idParam ? parseInt(idParam, 10) : undefined);
  const navigate = useNavigate();

  const { data: postData, isFetching: isFetchingPost } = useAdminBlogPostQuery(postId);
  const { data: categoriesData } = useAdminBlogCategoriesQuery();
  const { data: adminOptionsData } = useAdminOptionsQuery();
  const { authState } = useAdminAuth();
  const upsertMutation = useUpsertBlogPostMutation();
  const autoSaveMutation = useAutoSaveBlogPostMutation();

  const [currentStep, setCurrentStep] = useState(1);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'unsaved'>('idle');
  const [tagInput, setTagInput] = useState("");
  // Slug follows the title (or SEO title) until hand-edited; a saved post keeps following only while it is a draft
  const [slugAuto, setSlugAuto] = useState(!idParam);

  const { setHeaderHidden } = useAdminLayout();

  useEffect(() => {
    setHeaderHidden(true);
    return () => setHeaderHidden(false);
  }, [setHeaderHidden]);

  const [headerHeight, setHeaderHeight] = useState(0);
  const headerObserverRef = useRef<ResizeObserver | null>(null);
  const headerRef = useCallback((el: HTMLElement | null) => {
    headerObserverRef.current?.disconnect();
    headerObserverRef.current = null;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    observer.observe(el);
    headerObserverRef.current = observer;
  }, []);

  const form = useForm({
    schema: upsertPostSchema,
    defaultValues: {
      title: "",
      slug: "",
      content: "",
      excerpt: "",
      type: (typeParam === 'knowledge_base' ? 'knowledge_base' : 'blog') as "blog" | "knowledge_base",
      categoryId: undefined,
      featuredImage: "",
      status: "draft",
      seoTitle: "",
      seoDescription: "",
      ogImage: "",
      isFeatured: false,
      tags: []
    }
  });

  const formValuesRef = useRef(form.values);
  formValuesRef.current = form.values;
  const isFirstRender = useRef(true);
  const hasInitializedRef = useRef(false);

  // Initialize from data
  useEffect(() => {
    if (postData?.post && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      form.setValues({
        id: postData.post.id,
        title: postData.post.title,
        slug: postData.post.slug,
        content: postData.post.content,
        excerpt: postData.post.excerpt || "",
        type: postData.post.type,
        categoryId: postData.post.categoryId || undefined,
        featuredImage: postData.post.featuredImage || "",
        status: postData.post.status,
        seoTitle: postData.post.seoTitle || "",
        seoDescription: postData.post.seoDescription || "",
        ogImage: postData.post.ogImage || "",
        isFeatured: postData.post.isFeatured,
        tags: postData.post.tags || [],
        authorId: postData.post.authorId
      });
      setSlugAuto(
        postData.post.status === "draft" &&
          [slugify(postData.post.title), slugify(postData.post.seoTitle || "")].includes(postData.post.slug)
      );
      setCurrentStep((step) => Math.max(step, 2)); // Skip type selection if editing, never pull back from settings
    } else if (typeParam || idParam) {
      setCurrentStep((step) => Math.max(step, 2));
    }
  }, [postData, typeParam, idParam, form.setValues]);

  // Auto-save logic
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    if (currentStep < 2) return;

    setSaveStatus('unsaved');
    const timer = setTimeout(() => {
      setSaveStatus('saving');
      const payload = { ...formValuesRef.current };
      if (!payload.slug) payload.slug = deriveSlug(payload);
      if (!payload.title) payload.title = "Untitled post";
      if (!payload.content) payload.content = "<p></p>";
      
      autoSaveMutation.mutate(payload, {
        onSuccess: (data) => {
          setSaveStatus('saved');
          if (!postId && data.post.id) {
            hasInitializedRef.current = true;
            setPostId(data.post.id);
            navigate(`/admin/blog/e/${data.post.id}`, { replace: true });
            form.setValues(prev => ({ ...prev, id: data.post.id }));
          }
        },
        onError: () => {
          setSaveStatus('unsaved');
        }
      });
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [form.values.title, form.values.content]); // Only trigger auto-save on title/content change

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    form.setValues((prev) => ({ ...prev, title, slug: slugAuto ? deriveSlug({ ...prev, title }) : prev.slug }));
  };

  // Tags that share a slug are one tag on the server, so dedupe the same way
  const addTags = (raw: string) => {
    const incoming = raw.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
    if (incoming.length === 0) return;
    form.setValues((prev) => {
      const tagKey = (tag: string) => slugify(tag) || tag.toLowerCase();
      const seen = new Set(prev.tags.map(tagKey));
      const tags = [...prev.tags];
      for (const tag of incoming) {
        if (seen.has(tagKey(tag))) continue;
        seen.add(tagKey(tag));
        tags.push(tag);
      }
      return { ...prev, tags };
    });
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTags(tagInput);
      setTagInput("");
    }
  };

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parts = e.target.value.split(",");
    const pending = parts.pop() ?? "";
    if (parts.length === 0) {
      setTagInput(pending);
      return;
    }
    addTags(parts.join(","));
    setTagInput(pending.trimStart());
  };

  const handleTagPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!/[,\n]/.test(pasted)) return;
    e.preventDefault();
    const { selectionStart, selectionEnd } = e.currentTarget;
    addTags(
      tagInput.slice(0, selectionStart ?? tagInput.length) + pasted + tagInput.slice(selectionEnd ?? tagInput.length)
    );
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    form.setValues((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tagToRemove) }));
  };

  const handlePublish = (statusOverride?: 'draft' | 'published' | 'archived') => {
    const payload = { ...form.values };
    if (statusOverride) payload.status = statusOverride;
    if (!payload.slug) payload.slug = deriveSlug(payload);
    if (!payload.title) payload.title = "Untitled post";
    if (!payload.content) payload.content = "<p></p>";

    upsertMutation.mutate(payload, {
      onSuccess: () => {
        navigate("/admin/blog");
      }
    });
  };

  const filteredCategories = categoriesData?.categories.filter(c => c.type === form.values.type) || [];

  // A new post is authored by the signed-in admin until another admin is picked
  const authorId = form.values.authorId ?? (authState.type === "authenticated" ? authState.admin.id : undefined);
  const adminOptions = adminOptionsData?.admins ?? [];
  const activeAdmins = adminOptions.filter((admin) => admin.isActive);
  const currentAuthor = adminOptions.find((admin) => admin.id === authorId);
  const showCurrentAuthorOption = adminOptionsData !== undefined && authorId !== undefined && !currentAuthor?.isActive;

  if (isFetchingPost && !postData && postId) {
    return (
      <div className={styles.pageContainer}>
        <Skeleton style={{ height: "72px", marginBottom: "var(--spacing-6)" }} />
        <div className={styles.workspace}>
          <Skeleton style={{ height: "60px", marginBottom: "var(--spacing-4)" }} />
          <Skeleton style={{ height: "400px" }} />
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`${postId ? "Edit post" : "New post"} | Testkart Admin`}</title>
      </Helmet>
      
      <Form {...form}>
        <div
          className={styles.pageContainer}
          style={{ "--rte-toolbar-top": `${headerHeight}px` } as React.CSSProperties}
        >
          {/* Sticky header; the editor toolbar sticks below it */}
          <header ref={headerRef} className={styles.header}>
            <div className={styles.headerLeft}>
              <Button variant="ghost" size="icon-md" asChild>
                <Link to="/admin/blog" aria-label="Back to posts"><ArrowLeft size={18} /></Link>
              </Button>
              
              {/* Step Indicator */}
              <div className={styles.stepIndicator}>
                {[
                  { num: 1, label: "Content type" },
                  { num: 2, label: "Write" },
                  { num: 3, label: "Settings and publish" }
                ].map((step) => {
                  const isCompleted = currentStep > step.num;
                  const isCurrent = currentStep === step.num;
                  const isClickable = isCompleted || isCurrent;
                  
                  return (
                    <React.Fragment key={step.num}>
                      <button
                        type="button"
                        className={`${styles.step} ${isCurrent ? styles.stepCurrent : ''} ${isCompleted ? styles.stepCompleted : ''}`}
                        onClick={() => setCurrentStep(step.num)}
                        disabled={!isClickable}
                        aria-current={isCurrent ? "step" : undefined}
                      >
                        <span className={styles.stepCircle}>
                          {isCompleted ? <Check size={14} /> : step.num}
                        </span>
                        <span className={styles.stepLabel}>{step.label}</span>
                      </button>
                      {step.num < 3 && <span className={styles.stepLine} aria-hidden="true" />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            <div className={styles.headerRight}>
              {currentStep === 2 && (
                <>
                  <div className={styles.saveStatus}>
                    {saveStatus === 'saving' && <><Loader2 className={styles.spinIcon} size={14} /> Saving...</>}
                    {saveStatus === 'saved' && <><div className={`${styles.statusDot} ${styles.statusDotGreen}`} /> Saved</>}
                    {saveStatus === 'unsaved' && <><div className={`${styles.statusDot} ${styles.statusDotYellow}`} /> Unsaved changes</>}
                  </div>
                  <Button onClick={() => setCurrentStep(3)}>
                    Next: settings
                  </Button>
                </>
              )}
              {currentStep === 3 && (
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  <ArrowLeft size={16} /> Back to editor
                </Button>
              )}
            </div>
          </header>

          <div className={styles.contentArea}>
            {/* Step 1: Content Type Selection */}
            {currentStep === 1 && (
              <div className={styles.step1Container}>
                <h2 className={styles.stepHeading}>What are you creating?</h2>
                <div className={styles.typeCards}>
                  <button
                    type="button"
                    className={styles.typeCard}
                    onClick={() => {
                      form.setValues(prev => ({ ...prev, type: "blog" }));
                      setCurrentStep(2);
                    }}
                  >
                    <span className={styles.typeIcon}><Newspaper size={32} /></span>
                    <span className={styles.typeTitle}>Blog post</span>
                    <span className={styles.typeText}>SEO-focused articles, tutorials, and news for your audience.</span>
                  </button>
                  <button
                    type="button"
                    className={styles.typeCard}
                    onClick={() => {
                      form.setValues(prev => ({ ...prev, type: "knowledge_base" }));
                      setCurrentStep(2);
                    }}
                  >
                    <span className={styles.typeIcon}><BookOpen size={32} /></span>
                    <span className={styles.typeTitle}>Help article</span>
                    <span className={styles.typeText}>Help guides and documentation for your help pages.</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Write Content */}
            {currentStep === 2 && (
              <div className={styles.workspace}>
                <FormItem name="title" className={styles.titleFormItem}>
                  <FormControl>
                    <input
                      className={styles.workspaceTitle}
                      placeholder="Untitled post..."
                      value={form.values.title}
                      onChange={handleTitleChange}
                    />
                  </FormControl>
                </FormItem>

                <FormItem name="content">
                  <FormControl>
                    <RichTextEditor
                      className={styles.workspaceEditor}
                      value={form.values.content}
                      onChange={(val) => form.setValues((prev) => ({ ...prev, content: val }))}
                      placeholder="Start writing your post here..." 
                      enableProductEmbed
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>
            )}

            {/* Step 3: Settings & Publish */}
            {currentStep === 3 && (
              <div className={styles.settingsLayout}>
                <div className={styles.settingsColumnLeft}>
                  <div className={styles.settingsCard}>
                    <h3 className={styles.sectionTitle}>SEO and metadata</h3>
                    
                    <FormItem name="seoTitle">
                      <FormLabel>SEO title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="SEO title for search engines"
                          value={form.values.seoTitle || ""}
                          onChange={(e) => {
                            const seoTitle = e.target.value;
                            form.setValues((prev) => ({ ...prev, seoTitle, slug: slugAuto ? deriveSlug({ ...prev, seoTitle }) : prev.slug }));
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="slug">
                      <FormLabel>URL slug</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="your-post-slug"
                          value={form.values.slug}
                          onChange={(e) => {
                            const slug = e.target.value;
                            setSlugAuto(slug === "");
                            form.setValues((prev) => ({ ...prev, slug }));
                          }}
                        />
                      </FormControl>
                      <div className={styles.urlPreview}>
                        Preview: testkart.in/{form.values.type === 'knowledge_base' ? 'help' : 'blog'}/
                        <strong>{form.values.slug || deriveSlug(form.values) || "untitled-post"}</strong>
                      </div>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="excerpt">
                      <FormLabel>Excerpt</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="A short summary for previews..."
                          value={form.values.excerpt || ""}
                          onChange={(e) => form.setValues((prev) => ({ ...prev, excerpt: e.target.value }))}
                          rows={3} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="seoDescription">
                      <FormLabel>SEO description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Meta description for search engines..."
                          value={form.values.seoDescription || ""}
                          onChange={(e) => form.setValues((prev) => ({ ...prev, seoDescription: e.target.value }))}
                          rows={3} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="ogImage">
                      <FormLabel>Social image</FormLabel>
                      <FormControl>
                        <ImageUploader
                          folder="blog-images"
                          currentImageUrl={form.values.ogImage || undefined}
                          onSuccess={({ url }) => form.setValues((prev) => ({ ...prev, ogImage: url }))}
                          label="Upload social image"
                          aspectRatio="1200 / 630" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </div>
                </div>

                <div className={styles.settingsColumnRight}>
                  <div className={styles.settingsCard}>
                    <h3 className={styles.sectionTitle}>Publishing</h3>

                    <FormItem name="authorId">
                      <FormLabel>Author</FormLabel>
                      <Select
                        value={adminOptionsData && authorId !== undefined ? String(authorId) : ""}
                        onValueChange={(val) => form.setValues((prev) => ({ ...prev, authorId: Number(val) }))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={adminOptionsData ? "Choose an author" : "Loading admins..."} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {showCurrentAuthorOption && (
                            <SelectItem value={String(authorId)}>
                              {currentAuthor ? `${currentAuthor.fullName} (inactive)` : "Unknown admin"}
                            </SelectItem>
                          )}
                          {activeAdmins.map((admin) => (
                            <SelectItem key={admin.id} value={String(admin.id)}>{admin.fullName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>

                                        <FormItem name="categoryId">
                      <FormLabel>Category</FormLabel>
                      <Select
                        value={form.values.categoryId ? String(form.values.categoryId) : "__empty"}
                        onValueChange={(val) => form.setValues((prev) => ({ ...prev, categoryId: val === "__empty" ? undefined : Number(val) }))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__empty">Uncategorized</SelectItem>
                          {filteredCategories.map((cat) =>
                            <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="tags">
                      <FormLabel>Tags</FormLabel>
                      <div className={styles.tagsContainer}>
                        {form.values.tags.map((tag) =>
                          <Badge key={tag} variant="secondary" className={styles.tagBadge}>
                            {tag}
                            <button
                              type="button"
                              className={styles.removeTag}
                              onClick={() => handleRemoveTag(tag)}
                              aria-label={`Remove ${tag}`}
                            >
                              <X size={12} />
                            </button>
                          </Badge>
                        )}
                      </div>
                      <FormControl>
                        <Input
                          placeholder="Type a tag and press Enter"
                          value={tagInput}
                          onChange={handleTagInputChange}
                          onKeyDown={handleAddTag}
                          onPaste={handleTagPaste}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="isFeatured">
                      <div className={styles.switchRow}>
                        <FormLabel>Featured post</FormLabel>
                        <FormControl>
                          <Switch
                            checked={form.values.isFeatured}
                            onCheckedChange={(checked) => form.setValues((prev) => ({ ...prev, isFeatured: checked }))} 
                          />
                        </FormControl>
                      </div>
                    </FormItem>

                    <div className={styles.publishActions}>
                      {form.values.status === 'draft' && (
                        <>
                          <Button 
                            className={styles.fullWidthBtn}
                            variant="primary" 
                            onClick={() => handlePublish('published')} 
                            disabled={upsertMutation.isPending}
                          >
                            Publish post
                          </Button>
                          <Button 
                            className={styles.fullWidthBtn}
                            variant="outline" 
                            onClick={() => handlePublish('draft')} 
                            disabled={upsertMutation.isPending}
                          >
                            Save as draft
                          </Button>
                        </>
                      )}
                      {form.values.status === 'published' && (
                        <>
                          <Button 
                            className={styles.fullWidthBtn}
                            variant="primary" 
                            onClick={() => handlePublish('published')} 
                            disabled={upsertMutation.isPending}
                          >
                            Update
                          </Button>
                          <Button 
                            className={styles.fullWidthBtn}
                            variant="outline" 
                            onClick={() => handlePublish('draft')} 
                            disabled={upsertMutation.isPending}
                          >
                            Unpublish
                          </Button>
                        </>
                      )}
                      {form.values.status === 'archived' && (
                        <Button 
                          className={styles.fullWidthBtn}
                          variant="primary" 
                          onClick={() => handlePublish('draft')} 
                          disabled={upsertMutation.isPending}
                        >
                          Restore to draft
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Form>
    </>
  );
};

export default AdminBlogEditorPage;