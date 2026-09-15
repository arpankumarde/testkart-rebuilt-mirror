import React, { useEffect, useMemo } from "react";
import { Helmet } from "react-helmet";
import { useAdminStaticPagesQuery, useUpdateStaticPageMutation } from '../helpers/useAdminStaticPages';
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/Tabs';
import { Skeleton } from '../components/Skeleton';
import { AlertCircle, FileText } from "lucide-react";
import { z } from "zod";
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage } from '../components/Form';
import { Input } from '../components/Input';
import { RichTextEditor } from '../components/RichTextEditor';
import { Button } from '../components/Button';
import { ConsolePageHeader } from '../components/ConsolePageHeader';
import { ConsoleListEmpty } from '../components/ConsoleListEmpty';
import { ConsoleFilterNotice } from "../components/ConsoleFilterNotice";
import { schema as updateStaticPageSchema } from '../endpoints/admin/static-pages/update_POST.schema';
import { CONTENT_STALE_DAYS } from "../endpoints/admin/content/dashboard_GET.schema";
import { Selectable } from "kysely";
import { StaticPages } from '../helpers/schema';
import styles from "./admin.static-pages.module.css";

const DAY_MS = 24 * 60 * 60 * 1000;

/* The content dashboard's stale rule: updated_at is set and older than the cutoff. */
const isStale = (page: Selectable<StaticPages>, now: number) =>
  page.updatedAt !== null && new Date(page.updatedAt).getTime() < now - CONTENT_STALE_DAYS * DAY_MS;

type StaticPageFormProps = {
  page: Selectable<StaticPages>;
};

const StaticPageForm: React.FC<StaticPageFormProps> = ({ page }) => {
  const updateMutation = useUpdateStaticPageMutation();

  const form = useForm({
    schema: updateStaticPageSchema,
    defaultValues: {
      id: page.id,
      title: page.title,
      content: page.content
    }
  });

  useEffect(() => {
    form.setValues({
      id: page.id,
      title: page.title,
      content: page.content
    });
  }, [page, form.setValues]);

  const onSubmit = (values: z.infer<typeof updateStaticPageSchema>) => {
    updateMutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
        <FormItem name="title">
          <FormLabel>Page title</FormLabel>
          <FormControl>
            <Input
              value={form.values.title}
              onChange={(e) => form.setValues((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Enter page title" />

          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="content">
          <FormLabel>Page content</FormLabel>
          <FormControl>
            <RichTextEditor
              value={form.values.content}
              onChange={(value) => form.setValues((prev) => ({ ...prev, content: value }))} />

          </FormControl>
          <FormMessage />
        </FormItem>

        <div className={styles.formFooter}>
          <span className={styles.lastUpdated}>
            Last updated {new Date(page.updatedAt!).toLocaleString()}
          </span>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>);

};

const AdminStaticPages = () => {
  const { data: pages, isFetching, error, refetch } = useAdminStaticPagesQuery();
  // ?page=<slug> picks the tab and ?filter=stale marks the pages the content dashboard counted as stale.
  const { read, write, searchParams } = useListUrlParams();
  const staleFilter = read<"stale" | "none">("filter", ["stale"], "none") === "stale";
  useRefetchOnLinkArrival(staleFilter || searchParams.has("page"), isFetching, refetch);

  const staleSlugs = useMemo(() => {
    const now = Date.now();
    return new Set((pages ?? []).filter((page) => isStale(page, now)).map((page) => page.slug));
  }, [pages]);

  const slugs = (pages ?? []).map((page) => page.slug);
  const firstStaleSlug = staleFilter ? slugs.find((slug) => staleSlugs.has(slug)) : undefined;
  const activeTab = read("page", slugs, firstStaleSlug ?? slugs[0] ?? "");

  const renderContent = () => {
    if (isFetching) {
      return (
        <div className={styles.skeletonStack} aria-busy="true">
          <Skeleton style={{ height: '2.5rem', width: '18rem' }} />
          <Skeleton style={{ height: '20rem', width: '100%', borderRadius: 'var(--radius-md)' }} />
        </div>);

    }

    if (error) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the static pages"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>);

    }

    if (!pages || pages.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<FileText size={24} />}
          title="No static pages yet"
          description="Terms, privacy and refund pages appear here once they exist."
        />);

    }

    return (
      <Tabs value={activeTab} onValueChange={(slug) => write({ page: slug })} className={styles.tabs}>
        <TabsList className={styles.tabsList}>
          {pages.map((page) =>
          <TabsTrigger key={page.slug} value={page.slug}>
              {page.title}
              {staleFilter && staleSlugs.has(page.slug) &&
              <span className={styles.staleChip}>{CONTENT_STALE_DAYS}+ days</span>
              }
            </TabsTrigger>
          )}
        </TabsList>
        {pages.map((page) =>
        <TabsContent key={page.slug} value={page.slug}>
            <div className={styles.card}>
              <StaticPageForm page={page} />
            </div>
          </TabsContent>
        )}
      </Tabs>);

  };

  return (
    <>
      <Helmet>
        <title>Static pages - Testkart Admin</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Static pages" />
        {staleFilter &&
        <ConsoleFilterNotice
          label={`Static pages not edited in ${CONTENT_STALE_DAYS} days`}
          count={pages ? staleSlugs.size : undefined}
          onClear={() => write({ filter: null })} />
        }
        {renderContent()}
      </div>
    </>);

};

export default AdminStaticPages;
