/**
 * Server-rendered pages for the MCP OAuth consent step, for both connectors.
 *
 * There is deliberately no password field here. Authorization requires an existing Testkart
 * session - the admin session for the admin connector, a teacher session for the teacher
 * connector - so this adds no new place to submit credentials. A signed-out user is pointed at
 * the normal login and comes back.
 *
 * Colours follow base.css: --primary is hsl(20 100% 70%), a coral that only reaches 2.1:1 against
 * white, so its foreground is ink (hsl(20 100% 10%)), never white.
 */

import type { McpAudience } from "./mcpOauth";

const OAUTH_FIELDS = [
  "client_id",
  "redirect_uri",
  "state",
  "response_type",
  "scope",
  "code_challenge",
  "code_challenge_method",
  "resource",
] as const;

type ConnectorCopy = {
  title: string;
  target: string;
  sessionLabel: string;
  loginPath: string;
  loginLabel: string;
  can: string[];
  cannot: string[];
};

const CONNECTORS: Record<McpAudience, ConnectorCopy> = {
  admin: {
    title: "Testkart admin",
    target: "the Testkart admin panel",
    sessionLabel: "an active Testkart admin session",
    loginPath: "/admin/login",
    loginLabel: "Open admin login",
    can: [
      "Read admin data, including students, teachers, orders and finance",
      "Create and edit blog, knowledge base and help articles",
      "Manage categories, comments, news coverage, careers and exam content pages",
    ],
    cannot: [
      "Issue refunds, process withdrawals or change subscriptions",
      "Create or modify admin accounts, or change settings",
    ],
  },
  teacher: {
    title: "Testkart teacher",
    target: "your Testkart teacher account",
    sessionLabel: "an active Testkart teacher session",
    loginPath: "/teacher/login",
    loginLabel: "Open teacher login",
    can: [
      "Read your tests, courses, study notes, bundles, students, earnings and support threads",
      "Create, edit, publish and delete your content, questions and team",
      "Request withdrawals, save bank details and subscribe to plans, each only after you confirm",
    ],
    cannot: ["Cancel your subscription or payment mandate", "Create or change promo codes"],
  },
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLES = `
:root {
  color-scheme: light dark;
  --bg: hsl(30 20% 98%);
  --surface: hsl(0 0% 100%);
  --border: hsl(30 10% 85%);
  --ink: hsl(20 15% 12%);
  --muted: hsl(20 8% 38%);
  --primary: hsl(20 100% 70%);
  --primary-foreground: hsl(20 100% 10%);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: hsl(20 12% 10%);
    --surface: hsl(20 10% 15%);
    --border: hsl(20 8% 32%);
    --ink: hsl(30 20% 96%);
    --muted: hsl(30 8% 70%);
    --primary: hsl(20 95% 65%);
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 24px; background: var(--bg); color: var(--ink);
  font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
}
.card {
  width: 100%; max-width: 460px; background: var(--surface);
  border: 1px solid var(--border); border-radius: 12px; padding: 32px;
}
h1 { margin: 0 0 6px; font-size: 21px; }
.sub { margin: 0 0 22px; color: var(--muted); font-size: 14px; }
.who {
  margin: 0 0 20px; padding: 12px 14px; font-size: 14px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 8px;
}
.who strong { font-weight: 600; }
.notice {
  margin: 0 0 20px; padding: 12px 14px; font-size: 14px; color: var(--ink);
  background: var(--bg); border: 1px solid var(--primary); border-radius: 8px;
}
.scope { margin: 0 0 24px; font-size: 14px; }
.scope strong { display: block; margin-bottom: 8px; }
.scope ul { margin: 0; padding-left: 20px; color: var(--muted); }
.scope li { margin-bottom: 4px; }
.actions { display: flex; gap: 10px; }
button, .btn {
  flex: 1; padding: 11px 14px; font: inherit; font-weight: 600; text-align: center;
  cursor: pointer; border-radius: 8px; text-decoration: none; display: block;
}
.primary { color: var(--primary-foreground); background: var(--primary); border: 1px solid var(--primary); }
.secondary { color: var(--ink); background: transparent; border: 1px solid var(--border); }
button:hover, .btn:hover { filter: brightness(0.96); }
.foot { margin: 20px 0 0; font-size: 12px; color: var(--muted); text-align: center; }
.error {
  margin: 0 0 18px; padding: 12px 14px; font-size: 14px; border-radius: 8px;
  color: hsl(0 65% 30%); background: hsl(0 80% 96%); border: 1px solid hsl(0 70% 70%);
}
@media (prefers-color-scheme: dark) {
  .error { color: hsl(0 80% 88%); background: hsl(0 40% 20%); border-color: hsl(0 50% 45%); }
}
`;

function page(title: string, body: string, status = 200, head = ""): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  ${head}
  <title>${escapeHtml(title)}</title>
  <style>${STYLES}</style>
</head>
<body><main class="card">${body}</main></body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
    },
  });
}

function listItems(items: string[]): string {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n        ");
}

export function renderConsentPage(options: {
  audience: McpAudience;
  params: URLSearchParams;
  clientName: string;
  accountName: string;
  accountDetail: string;
  notice: string | null;
}): Response {
  const copy = CONNECTORS[options.audience];
  const hidden = OAUTH_FIELDS.map((field) => {
    const value = options.params.get(field);
    return value === null
      ? ""
      : `<input type="hidden" name="${field}" value="${escapeHtml(value)}">`;
  }).join("\n      ");

  return page(
    `Authorize access - ${copy.title}`,
    `
    <h1>Authorize access</h1>
    <p class="sub">${escapeHtml(options.clientName)} is requesting access to ${escapeHtml(copy.target)}.</p>

    <p class="who">Signed in as <strong>${escapeHtml(options.accountName)}</strong> (${escapeHtml(options.accountDetail)})</p>
    ${options.notice ? `<p class="notice">${escapeHtml(options.notice)}</p>` : ""}

    <div class="scope">
      <strong>This will allow it to</strong>
      <ul>
        ${listItems(copy.can)}
      </ul>
      <strong style="margin-top:14px">It will not be able to</strong>
      <ul>
        ${listItems(copy.cannot)}
      </ul>
    </div>

    <form method="POST" class="actions">
      ${hidden}
      <button type="submit" name="action" value="deny" class="secondary">Cancel</button>
      <button type="submit" name="action" value="allow" class="primary">Authorize</button>
    </form>

    <p class="foot">You can revoke this at any time by removing the connector.</p>
  `
  );
}

/**
 * The teacher session cookie is SameSite=Strict, so the browser withholds it on the cross-site
 * navigation that arrives from the MCP client. Reloading from this testkart.in page makes the
 * request same-site, and the cookie comes along.
 */
export function renderSessionCheck(audience: McpAudience, target: string): Response {
  const copy = CONNECTORS[audience];
  const href = escapeHtml(target);
  return page(
    `Checking your session - ${copy.title}`,
    `
    <h1>Checking your session</h1>
    <p class="sub">One moment while Testkart confirms you are signed in.</p>
    <div class="actions">
      <a class="btn primary" href="${href}">Continue</a>
    </div>
  `,
    200,
    `<meta http-equiv="refresh" content="0;url=${href}">`
  );
}

export function renderSignInRequired(audience: McpAudience, returnTo: string): Response {
  const copy = CONNECTORS[audience];
  return page(
    `Sign in required - ${copy.title}`,
    `
    <h1>Sign in first</h1>
    <p class="sub">Authorizing this connector needs ${escapeHtml(copy.sessionLabel)}.</p>
    <div class="scope">
      <ol style="margin:0;padding-left:20px;color:var(--muted)">
        <li>Open the login page and sign in.</li>
        <li>Come back to this page and continue.</li>
      </ol>
    </div>
    <div class="actions">
      <a class="btn secondary" href="${copy.loginPath}" target="_blank" rel="noopener">${escapeHtml(copy.loginLabel)}</a>
      <a class="btn primary" href="${escapeHtml(returnTo)}">Continue</a>
    </div>
    <p class="foot">No password is ever entered on this page.</p>
  `,
    401
  );
}

export function renderOAuthError(
  audience: McpAudience,
  message: string,
  heading = "Authorization failed",
  status = 400
): Response {
  const copy = CONNECTORS[audience];
  return page(
    `${heading} - ${copy.title}`,
    `
    <h1>${escapeHtml(heading)}</h1>
    <div class="error">${escapeHtml(message)}</div>
    <p class="sub">Close this window and try connecting again. If it keeps failing, the connector may be misconfigured.</p>
  `,
    status
  );
}
