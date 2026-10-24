import React, { useState } from "react";
import { Example } from "@floot/examples";
import { Badge } from "./Badge";
import { ContentVisibilityPicker } from "./ContentVisibilityPicker";
import type { ContentVisibility } from "../helpers/schema";

const Controlled = ({
  initial,
  footnote,
  disabled,
  pending,
}: {
  initial: ContentVisibility;
  footnote?: string;
  disabled?: boolean;
  pending?: boolean;
}) => {
  const [value, setValue] = useState<ContentVisibility>(initial);
  return (
    <ContentVisibilityPicker
      value={value}
      onChange={setValue}
      footnote={footnote}
      disabled={disabled}
      status={pending ? <Badge variant="warning">Pending review</Badge> : undefined}
      locked={pending ? { value: "public", tag: "Pending review" } : undefined}
    />
  );
};

export default function Showcase() {
  return (
    <>
      <h1>ContentVisibilityPicker</h1>
      <p>Compact public or unlisted choice inside ContentVisibilityPanel, shown at each item's publish step.</p>

      <Example title="Public (default)">
        <Controlled initial="public" />
      </Example>
      <Example title="Unlisted, with footnote">
        <Controlled initial="unlisted" footnote="Live as unlisted. Anyone with the link can open and share it." />
      </Example>
      <Example title="Disabled while saving">
        <Controlled initial="public" disabled />
      </Example>
      <Example title="Public request pending">
        <Controlled initial="unlisted" pending />
      </Example>
    </>
  );
}