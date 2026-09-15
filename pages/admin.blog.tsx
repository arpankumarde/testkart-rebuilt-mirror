import React from "react";
import { Helmet } from "react-helmet";
import { Link, useSearchParams } from "react-router-dom";
import { Tags } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import { Button } from "../components/Button";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { AdminBlogContentTab } from "../components/AdminBlogContentTab";
import { ARTICLE_TABS } from "../helpers/adminContentSurfaces";
import styles from "./admin.blog.module.css";

const TABS = [ARTICLE_TABS.blog, ARTICLE_TABS.knowledge_base] as const;
type TabValue = (typeof TABS)[number];

const AdminBlogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const tab: TabValue = (TABS as readonly string[]).includes(requested ?? "") ? (requested as TabValue) : "blog";

  const changeTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <Helmet>
        <title>Blog and help pages - Testkart Admin</title>
      </Helmet>

      <div className={styles.page}>
        <ConsolePageHeader title="Blog and help pages">
          <Button variant="outline" asChild>
            <Link to="/admin/blog/category">
              <Tags size={16} /> Categories
            </Link>
          </Button>
        </ConsolePageHeader>

        <Tabs value={tab} onValueChange={changeTab} className={styles.tabs}>
          <TabsList className={styles.tabsList}>
            <TabsTrigger value={ARTICLE_TABS.blog}>Blog posts</TabsTrigger>
            <TabsTrigger value={ARTICLE_TABS.knowledge_base}>Help pages</TabsTrigger>
          </TabsList>

          <TabsContent value={ARTICLE_TABS.blog}>
            <AdminBlogContentTab type="blog" />
          </TabsContent>
          <TabsContent value={ARTICLE_TABS.knowledge_base}>
            <AdminBlogContentTab type="knowledge_base" />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default AdminBlogPage;
