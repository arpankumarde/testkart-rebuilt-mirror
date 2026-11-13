import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { Tags } from "lucide-react";
import { Button } from "./Button";
import { ConsolePageHeader } from "./ConsolePageHeader";
import { AdminBlogContentTab } from "./AdminBlogContentTab";
import { SURFACE_LABELS } from "../helpers/adminContentSurfaces";
import type { BlogContentType } from "../helpers/schema";
import styles from "./AdminArticlesPage.module.css";

/** The list page for one article type: /admin/blog for blog posts, /admin/help for help pages. */
export const AdminArticlesPage: React.FC<{ type: BlogContentType }> = ({ type }) => {
  const title = SURFACE_LABELS[type];
  const categoriesHref = type === "knowledge_base" ? "/admin/blog/category?from=help" : "/admin/blog/category";

  return (
    <>
      <Helmet>
        <title>{`${title} - Testkart Admin`}</title>
      </Helmet>

      <div className={styles.page}>
        <ConsolePageHeader title={title}>
          <Button variant="outline" asChild>
            <Link to={categoriesHref}>
              <Tags size={16} /> Categories
            </Link>
          </Button>
        </ConsolePageHeader>

        <AdminBlogContentTab key={type} type={type} />
      </div>
    </>
  );
};