import React from "react";
import { useParams } from "react-router-dom";
import { AdminContentEditShell } from "../components/AdminContentEditShell";
import { ProductStepForm } from "../components/ProductStepForm";

export default function AdminEditNotePage() {
  const { productId } = useParams<{ productId: string }>();
  const id = Number(productId);
  const validId = Number.isInteger(id) && id > 0 ? id : null;

  return (
    <AdminContentEditShell key={validId ?? "invalid"} type="digital_product" id={validId} listHref="/admin/notes" listLabel="study notes">
      {validId !== null && <ProductStepForm productId={validId} />}
    </AdminContentEditShell>
  );
}