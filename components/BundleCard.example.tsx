import { Example } from "@floot/examples";
import { BundleCard } from "./BundleCard";
import type { BundleListItem } from "../endpoints/teacher/bundles/list_GET.schema";
import styles from "./BundleCard.example.module.css";

const base: BundleListItem = {
  id: 1,
  title: "Complete UGC NET Paper 1 Batch",
  slug: "complete-ugc-net-paper-1-batch",
  isPublished: true,
  visibility: "public",
  createdAt: new Date("2026-09-01T10:00:00Z"),
  publishedAt: new Date("2026-09-02T10:00:00Z"),
  thumbnailUrl: null,
  price: 2800,
  originalPrice: 3297,
  currentOriginalPrice: 3297,
  itemCount: 3,
  studentsEnrolled: 12,
  inReview: false,
  rejection: null,
};

const noop = () => undefined;

export default function Showcase() {
  return (
    <>
      <h1>BundleCard</h1>
      <p>
        A teacher's bundle in the Bundles list. Manage opens the editor; Edit, Publish or Unpublish and Delete sit in
        the three-dot menu.
      </p>

      <h2>States</h2>
      <div className={styles.grid}>
        <Example title="Published">
          <BundleCard bundle={base} onEdit={noop} onDelete={noop} onPublishToggle={noop} />
        </Example>
        <Example title="Published, long title">
          <BundleCard
            bundle={{
              ...base,
              id: 2,
              title: "All Competitive Exams VVI MCQ Question Bank in Hindi Medium - Complete Chapter-wise Practice Set",
              itemCount: 56,
            }}
            onEdit={noop}
            onDelete={noop}
            onPublishToggle={noop}
          />
        </Example>
        <Example title="Draft">
          <BundleCard
            bundle={{ ...base, id: 3, isPublished: false, publishedAt: null }}
            onEdit={noop}
            onDelete={noop}
            onPublishToggle={noop}
          />
        </Example>
        <Example title="In review">
          <BundleCard
            bundle={{ ...base, id: 4, isPublished: false, publishedAt: null, inReview: true }}
            onEdit={noop}
            onDelete={noop}
            onPublishToggle={noop}
          />
        </Example>
        <Example title="Published, unlisted">
          <BundleCard
            bundle={{ ...base, id: 5, visibility: "unlisted" }}
            onEdit={noop}
            onDelete={noop}
            onPublishToggle={noop}
          />
        </Example>
      </div>
    </>
  );
}
