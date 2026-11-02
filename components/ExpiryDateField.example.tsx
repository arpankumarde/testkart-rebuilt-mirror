import React, { useState } from "react";
import { Example } from "@floot/examples";
import { ExpiryDateField } from "./ExpiryDateField";
import { TeacherListingBadges } from "./TeacherListingBadges";
import { EXPIRY_HELP, expiryCutoff, istDay } from "../helpers/contentExpiry";

const DAY_MS = 24 * 60 * 60 * 1000;
const dayFromNow = (days: number) => istDay(new Date(Date.now() + days * DAY_MS));

const Controlled = ({ initial }: { initial: string | null }) => {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <ExpiryDateField value={value} onChange={setValue} />
      <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>{EXPIRY_HELP}</p>
    </div>
  );
};

export default function Showcase() {
  return (
    <>
      <h1>ExpiryDateField</h1>
      <p>Optional last day on sale for a teacher product, with the listing badges teacher lists show.</p>

      <Example title="No expiry date">
        <Controlled initial={null} />
      </Example>
      <Example title="Date set">
        <Controlled initial={dayFromNow(30)} />
      </Example>
      <Example title="Badges">
        <div style={{ display: "grid", gap: "0.5rem", justifyItems: "start" }}>
          <TeacherListingBadges
            visibility="public"
            live
            inReview={false}
            rejected={false}
            expiresAt={expiryCutoff(dayFromNow(40))}
            expiredAt={null}
          />
          <TeacherListingBadges
            visibility="public"
            live
            inReview={false}
            rejected={false}
            expiresAt={expiryCutoff(dayFromNow(3))}
            expiredAt={null}
          />
          <TeacherListingBadges
            visibility="unlisted"
            live
            inReview={false}
            rejected={false}
            expiresAt={expiryCutoff(dayFromNow(-2))}
            expiredAt={new Date(Date.now() - DAY_MS)}
          />
          <TeacherListingBadges
            visibility="unlisted"
            live
            inReview={false}
            rejected={false}
            expiresAt={expiryCutoff(dayFromNow(20))}
            expiredAt={null}
          />
        </div>
      </Example>
    </>
  );
}
