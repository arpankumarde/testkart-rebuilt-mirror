import React from "react";
import { AdminArticlesPage } from "../components/AdminArticlesPage";

/** Help pages (blog_posts rows of type knowledge_base). Blog posts are at /admin/blog. */
const AdminHelpPage = () => <AdminArticlesPage type="knowledge_base" />;

export default AdminHelpPage;