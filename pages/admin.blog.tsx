import React from "react";
import { Helmet } from "react-helmet";
import { Link, useSearchParams } from "react-router-dom";
import { Tags } from "lucide-react";
import { Button } from "../components/Button";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { AdminBlogContentTab } from "../components/AdminBlogContentTab";
import { ARTICLE_TABS, SURFACE_LABELS } from "../helpers/adminContentSurfaces";
import styles from "./admin.blog.module.css";

/** /admin/blog serves both article types; ?tab=help picks help pages, anything else is blog posts. */
const AdminBlogPage = () => {
  const [searchParams] = useSearchParams();
  const type = searchParams.get("tab") === ARTICLE_TABS.knowledge_base ? "knowledge_base" : "blog";
  const title = SURFACE_LABELS[type];

  return (
    <>
      <Helmet>
        <title>{title} - Testkart Admin</title>
      </Helmet>

      <div className={styles.page}>
        <ConsolePageHeader title={title}>
          <Button variant="outline" asChild>
            <Link to="/admin/blog/category">
              <Tags size={16} /> Categories
            </Link>
          </Button>
        </ConsolePageHeader>

        <AdminBlogContentTab key={type} type={type} />
      </div>
    </>
  );
};

export default AdminBlogPage;
