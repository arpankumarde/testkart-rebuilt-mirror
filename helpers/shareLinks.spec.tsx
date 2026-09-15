import {
  buildPublicAssetUrl,
  buildShareIntentUrl,
  buildTrackedShareUrl,
  CERTIFICATE_SHARE_CAMPAIGN,
  EXPERT_PROFILE_SHARE_CAMPAIGN,
  PUBLIC_PAGE_SHARE_CAMPAIGN,
  SHARE_ASSET_LABELS,
  SITE_ORIGIN,
  TEACHER_CONSOLE_SHARE_CAMPAIGN,
  type ShareAssetKind,
} from "./shareLinks";

describe("buildPublicAssetUrl", () => {
  it("routes each asset kind to its public page", () => {
    expect(buildPublicAssetUrl("test-series", "ssc-cgl-2026")).toBe(
      `${SITE_ORIGIN}/mock-test/ssc-cgl-2026`
    );
    expect(buildPublicAssetUrl("live-test", 412)).toBe(`${SITE_ORIGIN}/mock-test/live/412`);
    expect(buildPublicAssetUrl("course", "physics-101")).toBe(`${SITE_ORIGIN}/course/physics-101`);
    expect(buildPublicAssetUrl("bundle", "gate-combo")).toBe(`${SITE_ORIGIN}/bundles/gate-combo`);
    expect(buildPublicAssetUrl("study-note", "thermo-notes")).toBe(
      `${SITE_ORIGIN}/study-notes/thermo-notes`
    );
    expect(buildPublicAssetUrl("expert", "hamraj-kumar")).toBe(
      `${SITE_ORIGIN}/expert/hamraj-kumar`
    );
    expect(buildPublicAssetUrl("blog-post", "how-to-crack-ssc")).toBe(
      `${SITE_ORIGIN}/blog/how-to-crack-ssc`
    );
    expect(buildPublicAssetUrl("help-article", "refund-policy")).toBe(
      `${SITE_ORIGIN}/help/refund-policy`
    );
    expect(buildPublicAssetUrl("certificate", "TK-2026-000123")).toBe(
      `${SITE_ORIGIN}/certificates/TK-2026-000123`
    );
    expect(buildPublicAssetUrl("exam-page", "ssc-cgl/exam-pattern")).toBe(
      `${SITE_ORIGIN}/exams/ssc-cgl/exam-pattern`
    );
    expect(buildPublicAssetUrl("news", "holistic-assessment")).toBe(
      `${SITE_ORIGIN}/news-and-events/holistic-assessment`
    );
  });

  it("keeps the exam page path separator but escapes each segment", () => {
    expect(buildPublicAssetUrl("exam-page", "ssc cgl/syllabus")).toBe(
      `${SITE_ORIGIN}/exams/ssc%20cgl/syllabus`
    );
  });

  it("always builds against the public site, never the console origin", () => {
    expect(buildPublicAssetUrl("course", "x").startsWith("https://testkart.in/")).toBe(true);
  });

  it("gives every kind a label for the dialog heading and message", () => {
    const kinds: ShareAssetKind[] = [
      "test-series",
      "live-test",
      "course",
      "bundle",
      "study-note",
      "expert",
      "blog-post",
      "help-article",
      "certificate",
      "exam-page",
      "news",
    ];
    for (const kind of kinds) {
      expect(SHARE_ASSET_LABELS[kind]).toBeTruthy();
    }
  });
});

describe("share campaigns", () => {
  it("keeps every surface in its own bucket", () => {
    const campaigns = [
      TEACHER_CONSOLE_SHARE_CAMPAIGN,
      EXPERT_PROFILE_SHARE_CAMPAIGN,
      PUBLIC_PAGE_SHARE_CAMPAIGN,
      CERTIFICATE_SHARE_CAMPAIGN,
    ];
    expect(new Set(campaigns).size).toBe(campaigns.length);
  });

  it("tags a profile share with the profile campaign", () => {
    const url = new URL(
      buildTrackedShareUrl(
        buildPublicAssetUrl("expert", "hamraj-kumar"),
        "whatsapp",
        EXPERT_PROFILE_SHARE_CAMPAIGN
      )
    );
    expect(url.pathname).toBe("/expert/hamraj-kumar");
    expect(url.searchParams.get("utm_source")).toBe("whatsapp");
    expect(url.searchParams.get("utm_medium")).toBe("social");
    expect(url.searchParams.get("utm_campaign")).toBe(EXPERT_PROFILE_SHARE_CAMPAIGN);
  });

  it("tags a copied profile link as a copy, not a social click", () => {
    const url = new URL(
      buildTrackedShareUrl(
        buildPublicAssetUrl("expert", "hamraj-kumar"),
        "copy",
        EXPERT_PROFILE_SHARE_CAMPAIGN
      )
    );
    expect(url.searchParams.get("utm_source")).toBe("copy_link");
    expect(url.searchParams.get("utm_medium")).toBe("copy");
    expect(url.searchParams.get("utm_campaign")).toBe(EXPERT_PROFILE_SHARE_CAMPAIGN);
  });
});

describe("buildTrackedShareUrl", () => {
  it("tags the link with the platform, channel and campaign", () => {
    const url = new URL(
      buildTrackedShareUrl(
        `${SITE_ORIGIN}/course/physics-101`,
        "whatsapp",
        TEACHER_CONSOLE_SHARE_CAMPAIGN
      )
    );
    expect(url.searchParams.get("utm_source")).toBe("whatsapp");
    expect(url.searchParams.get("utm_medium")).toBe("social");
    expect(url.searchParams.get("utm_campaign")).toBe("teacher_share");
  });

  it("distinguishes email and copy-link from social", () => {
    const email = new URL(
      buildTrackedShareUrl(`${SITE_ORIGIN}/course/a`, "email", PUBLIC_PAGE_SHARE_CAMPAIGN)
    );
    expect(email.searchParams.get("utm_medium")).toBe("email");

    const copy = new URL(
      buildTrackedShareUrl(`${SITE_ORIGIN}/course/a`, "copy", PUBLIC_PAGE_SHARE_CAMPAIGN)
    );
    expect(copy.searchParams.get("utm_source")).toBe("copy_link");
    expect(copy.searchParams.get("utm_medium")).toBe("copy");
  });

  it("keeps query parameters the url already had", () => {
    const url = new URL(
      buildTrackedShareUrl(`${SITE_ORIGIN}/course/a?ref=abc`, "x", PUBLIC_PAGE_SHARE_CAMPAIGN)
    );
    expect(url.searchParams.get("ref")).toBe("abc");
    expect(url.searchParams.get("utm_source")).toBe("x");
  });

  it("overwrites utm keys rather than appending duplicates", () => {
    const once = buildTrackedShareUrl(
      `${SITE_ORIGIN}/course/a`,
      "facebook",
      PUBLIC_PAGE_SHARE_CAMPAIGN
    );
    const twice = buildTrackedShareUrl(once, "telegram", PUBLIC_PAGE_SHARE_CAMPAIGN);
    expect((twice.match(/utm_source/g) ?? []).length).toBe(1);
    expect(new URL(twice).searchParams.get("utm_source")).toBe("telegram");
  });

  it("carries whichever campaign the caller asked for", () => {
    const url = new URL(buildTrackedShareUrl(`${SITE_ORIGIN}/course/a`, "x", "diwali_sale"));
    expect(url.searchParams.get("utm_campaign")).toBe("diwali_sale");
  });
});

describe("buildShareIntentUrl", () => {
  const tracked = buildTrackedShareUrl(
    `${SITE_ORIGIN}/course/physics-101`,
    "whatsapp",
    TEACHER_CONSOLE_SHARE_CAMPAIGN
  );

  it("carries the tagged url through to every platform", () => {
    const platforms = ["whatsapp", "facebook", "x", "telegram", "linkedin", "email"] as const;
    for (const platform of platforms) {
      const decoded = decodeURIComponent(buildShareIntentUrl(platform, tracked, "Look", "Subject"));
      expect(decoded).toContain("utm_source=whatsapp");
      expect(decoded).toContain("utm_campaign=teacher_share");
    }
  });

  it("points at each platform's own share endpoint", () => {
    expect(buildShareIntentUrl("whatsapp", tracked, "m", "s")).toContain("https://wa.me/");
    expect(buildShareIntentUrl("facebook", tracked, "m", "s")).toContain(
      "facebook.com/sharer/sharer.php"
    );
    expect(buildShareIntentUrl("x", tracked, "m", "s")).toContain("x.com/intent/post");
    expect(buildShareIntentUrl("telegram", tracked, "m", "s")).toContain("t.me/share/url");
    expect(buildShareIntentUrl("linkedin", tracked, "m", "s")).toContain(
      "linkedin.com/sharing/share-offsite"
    );
    expect(buildShareIntentUrl("email", tracked, "m", "s")).toMatch(/^mailto:/);
  });

  it("escapes a title containing url-significant characters", () => {
    const intent = buildShareIntentUrl("x", tracked, "50% off & more", "s");
    // The & must not be read as the start of another query parameter.
    expect(new URL(intent).searchParams.get("text")).toBe("50% off & more");
  });
});
