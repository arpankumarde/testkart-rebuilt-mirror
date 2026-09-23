import React from "react";
import { useParams } from "react-router-dom";
import { AdminContentEditShell } from "../components/AdminContentEditShell";
import { BundleEditor } from "../components/BundleEditor";
import { useAdminContentEdit } from "../helpers/useAdminContentEdit";

const Editor = ({ id }: { id: number }) => {
  const exitTo = useAdminContentEdit()?.exitTo ?? "/admin/bundles";
  return <BundleEditor bundleId={id} exitTo={exitTo} exitLabel="bundles" />;
};

export default function AdminEditBundlePage() {
  const { bundleId } = useParams<{ bundleId: string }>();
  const id = Number(bundleId);
  const validId = Number.isInteger(id) && id > 0 ? id : null;

  return (
    <AdminContentEditShell key={validId ?? "invalid"} type="course_bundle" id={validId} listHref="/admin/bundles" listLabel="bundles" narrow>
      {validId !== null && <Editor id={validId} />}
    </AdminContentEditShell>
  );
}