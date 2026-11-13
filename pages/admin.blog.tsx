import React from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { AdminArticlesPage } from "../components/AdminArticlesPage";
import { ARTICLE_LIST_HREFS } from "../helpers/adminContentSurfaces";

/*
 * Blog posts. Help pages moved to /admin/help; links saved from before the split
 * (/admin/blog?tab=help or ?tab=blog) are sent to the right page with their other params kept.
 */
const AdminBlogPage = () => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab");

  if (tab !== null) {
    const rest = new URLSearchParams(searchParams);
    rest.delete("tab");
    const path = tab === "help" ? ARTICLE_LIST_HREFS.knowledge_base : ARTICLE_LIST_HREFS.blog;
    const query = rest.toString();
    return <Navigate replace to={query ? `${path}?${query}` : path} />;
  }

  return <AdminArticlesPage type="blog" />;
};

export default AdminBlogPage;