import { sql } from "kysely";
import { db } from "./db";
import { getAutopilotSettings, offerExpiryDays } from "./getAutopilotSettings";
import { posteriorLift } from "./posteriorLift";
import { AUTOPILOT_PLAYBOOKS } from "./autopilotPlaybooks";

/**
 * Every figure on the admin Autopilot page, from one place so the page and the
 * daily digest always agree. Paid order = completed with a total above 0.
 * Take = what Testkart keeps: each item's net price times its platform fee,
 * or the order total times the order's fee for bundles. Server-only; uses the
 * global db, so call it outside transactions.
 */

export type AutopilotDashboard = {
  days: number;
  trackingSince: Date | null;
  settings: {
    enabled: boolean;
    shadow: boolean;
    holdoutPercent: number;
    hasHoldoutSalt: boolean;
    aiProvider: "deepseek" | "floot";
    deepseekConfigured: boolean;
  };
  kpis: {
    paidOrders: number;
    gmv: number;
    take: number;
    attributedOrders: number;
    attributedGmv: number;
    attributedTake: number;
    messageCostRupees: number;
    offerCostRupees: number;
    messagesSent: number;
  };
  coverage: { paidOrdersSinceTracking: number; withSource: number };
  funnel: { key: string; label: string; count: number }[];
  signedOutCartClicks: number;
  sources: { source: string; orders: number; gmv: number }[];
  channels: { channel: string; sent: number; delivered: number; opened: number; clicked: number; costRupees: number }[];
  playbooks: {
    key: string;
    label: string;
    goal: string;
    enrolled: number;
    holdout: number;
    treatedRate: number;
    holdoutRate: number;
    liftLow: number;
    liftHigh: number;
    lift: number;
    enoughData: boolean;
    messages: number;
    shadowMessages: number;
    clicked: number;
    orders: number;
    gmv: number;
  }[];
  incremental: { conversions: number; low: number; high: number; enoughData: boolean };
  /** "Ask someone to pay" links and the signed-out cart kept across sign-in. */
  checkoutHelpers: {
    payLinksCreated: number;
    payLinksOpened: number;
    payLinksPaid: number;
    payLinkGmv: number;
    guestCartMerges: number;
    guestCartItems: number;
    guestCartPaidUsers: number;
  };
  /** Shadow of the teacher fee-by-source model: sales through teachers' own share links. No fee changes. */
  teacherOwnLinks: { teacherName: string; ownOrders: number; ownGmv: number; totalGmv: number; feeAtTwelve: number; feeNow: number }[];
  checks: { key: string; status: string; value: number | null; ranAt: Date; detail: unknown }[];
  replies: { id: string; channel: string; body: string; receivedAt: Date; userName: string | null; playbook: string | null }[];
  /** Playbooks that give Tcoins on a step, with how many days those coins last. */
  tcoinOffers: { key: string; label: string; expiryDays: number }[];
};

type Row = Record<string, unknown>;

/* Raw sql rows come back camelCased by the plugin; read either spelling. */
const pick = (row: Row | undefined, snake: string): unknown => {
  if (!row) return undefined;
  if (snake in row) return row[snake];
  const camel = snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  return row[camel];
};
const num = (row: Row | undefined, key: string) => Number(pick(row, key) ?? 0) || 0;
const str = (row: Row | undefined, key: string) => String(pick(row, key) ?? "");

export async function getAutopilotDashboard(days: number): Promise<AutopilotDashboard> {
  const since = sql`now() - make_interval(days => ${days})`;

  const settings = await getAutopilotSettings();
  const trackingSince = settings.trackingStartedAt ? new Date(settings.trackingStartedAt) : null;
  const coverageFrom = trackingSince ?? new Date();

  const kpi = await sql<Row>`
    WITH paid AS (
      SELECT o.id, o.total_amount::numeric AS amt, o.platform_fee_percentage, o.attributed_message_id
      FROM orders o
      WHERE o.status = 'completed' AND o.total_amount > 0 AND o.created_at >= ${since}
    ), t AS (
      SELECT p.*, coalesce(
        (SELECT sum((oi.price_at_purchase - coalesce(oi.discount_amount, 0)) * oi.platform_fee_percentage / 100)
           FROM order_items oi WHERE oi.order_id = p.id),
        p.amt * coalesce(p.platform_fee_percentage, 28) / 100
      ) AS take
      FROM paid p
    )
    SELECT count(*)::int AS paid_orders,
           coalesce(sum(amt), 0)::float AS gmv,
           coalesce(sum(take), 0)::float AS take,
           count(*) FILTER (WHERE attributed_message_id IS NOT NULL)::int AS attributed_orders,
           coalesce(sum(amt) FILTER (WHERE attributed_message_id IS NOT NULL), 0)::float AS attributed_gmv,
           coalesce(sum(take) FILTER (WHERE attributed_message_id IS NOT NULL), 0)::float AS attributed_take
    FROM t
  `.execute(db);

  const costs = await sql<Row>`
    SELECT coalesce(sum(cost_paise), 0)::float AS paise, count(*) FILTER (WHERE sent_at IS NOT NULL)::int AS sent
    FROM rev_messages WHERE shadow = false AND created_at >= ${since}
  `.execute(db);
  const offers = await sql<Row>`
    SELECT coalesce(sum(cost_rupees), 0)::float AS rupees FROM rev_offers WHERE shadow = false AND created_at >= ${since}
  `.execute(db);

  const coverage = await sql<Row>`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE first_touch_source IS NOT NULL OR client_source IN ('android_app', 'ios_app'))::int AS with_source
    FROM orders
    WHERE status = 'completed' AND total_amount > 0 AND created_at >= ${since}
      AND created_at >= ${coverageFrom}
  `.execute(db);

  const funnel = await sql<Row>`
    SELECT
      (SELECT count(DISTINCT session_id)::int FROM storefront_events WHERE event_type = 'view' AND bucket_hour >= ${since}) AS viewers,
      (SELECT count(DISTINCT coalesce(visitor_id, user_id::text))::int FROM funnel_events WHERE event = 'add_to_cart_click' AND occurred_at >= ${since}) AS cart_clickers,
      (SELECT count(DISTINCT coalesce(visitor_id, user_id::text))::int FROM funnel_events WHERE event = 'add_to_cart_click' AND props->>'signedIn' = 'false' AND occurred_at >= ${since}) AS wall_hits,
      (SELECT count(DISTINCT user_id)::int FROM funnel_events WHERE event IN ('signup', 'login') AND occurred_at >= ${since}) AS signed_in,
      (SELECT count(DISTINCT user_id)::int FROM funnel_events WHERE event = 'checkout_started' AND amount > 0 AND occurred_at >= ${since}) AS checkout_users,
      (SELECT count(DISTINCT user_id)::int FROM funnel_events WHERE event = 'payment_succeeded' AND amount > 0 AND occurred_at >= ${since}) AS paid_users
  `.execute(db);
  const f = funnel.rows[0];

  const sources = await sql<Row>`
    SELECT coalesce(last_touch_source, first_touch_source,
             CASE WHEN client_source IN ('android_app', 'ios_app') THEN 'app' END, 'unknown') AS source,
           count(*)::int AS orders, coalesce(sum(total_amount), 0)::float AS gmv
    FROM orders
    WHERE status = 'completed' AND total_amount > 0 AND created_at >= ${since}
    GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  `.execute(db);

  const channels = await sql<Row>`
    SELECT channel::text AS channel,
           count(*) FILTER (WHERE sent_at IS NOT NULL)::int AS sent,
           count(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered,
           count(*) FILTER (WHERE opened_at IS NOT NULL OR read_at IS NOT NULL)::int AS opened,
           count(*) FILTER (WHERE first_clicked_at IS NOT NULL)::int AS clicked,
           coalesce(sum(cost_paise), 0)::float AS paise
    FROM rev_messages WHERE shadow = false AND created_at >= ${since}
    GROUP BY 1 ORDER BY 2 DESC
  `.execute(db);

  const messageStats = await sql<Row>`
    WITH m AS (SELECT * FROM rev_messages WHERE created_at >= ${since}),
    o AS (
      SELECT DISTINCT o.id, o.total_amount, m.playbook_key
      FROM orders o JOIN m ON o.attributed_message_id = m.id
      WHERE o.status = 'completed' AND o.total_amount > 0
    )
    SELECT m.playbook_key,
           count(*) FILTER (WHERE NOT m.shadow AND m.sent_at IS NOT NULL)::int AS messages,
           count(*) FILTER (WHERE m.shadow AND m.error = 'shadow')::int AS shadow_messages,
           count(*) FILTER (WHERE m.first_clicked_at IS NOT NULL)::int AS clicked,
           (SELECT count(*) FROM o WHERE o.playbook_key = m.playbook_key)::int AS orders,
           (SELECT coalesce(sum(o.total_amount), 0) FROM o WHERE o.playbook_key = m.playbook_key)::float AS gmv
    FROM m
    GROUP BY m.playbook_key ORDER BY 2 DESC
  `.execute(db);

  const enrolmentStats = await sql<Row>`
    WITH e AS (SELECT * FROM rev_enrolments WHERE created_at >= ${since}),
    g AS (
      SELECT e.playbook_key, e.is_holdout,
        CASE WHEN e.playbook_key = 'onboarding' THEN EXISTS (
          SELECT 1 FROM test_attempts t WHERE t.student_id = e.user_id
            AND t.started_at >= e.trigger_at AND t.started_at < e.trigger_at + interval '7 days')
        ELSE EXISTS (
          SELECT 1 FROM orders o WHERE o.user_id = e.user_id AND o.status = 'completed' AND o.total_amount > 0
            AND o.created_at >= e.trigger_at AND o.created_at < e.trigger_at + interval '7 days')
        END AS converted
      FROM e
    )
    SELECT playbook_key,
      count(*) FILTER (WHERE NOT is_holdout)::int AS treated,
      count(*) FILTER (WHERE NOT is_holdout AND converted)::int AS treated_conv,
      count(*) FILTER (WHERE is_holdout)::int AS holdout,
      count(*) FILTER (WHERE is_holdout AND converted)::int AS holdout_conv
    FROM g GROUP BY 1
  `.execute(db);

  const checks = await sql<Row>`
    SELECT DISTINCT ON (check_key) check_key, status::text AS status, value, detail, ran_at
    FROM autopilot_checks ORDER BY check_key, ran_at DESC
  `.execute(db);

  const k = kpi.rows[0];
  const helpers = await sql<Row>`
    SELECT
      (SELECT count(*)::int FROM pay_requests WHERE created_at >= ${since}) AS links_created,
      (SELECT count(*)::int FROM pay_requests WHERE created_at >= ${since} AND first_opened_at IS NOT NULL) AS links_opened,
      (SELECT count(*)::int FROM orders WHERE pay_request_id IS NOT NULL AND status = 'completed' AND created_at >= ${since}) AS links_paid,
      (SELECT coalesce(sum(total_amount), 0)::float FROM orders WHERE pay_request_id IS NOT NULL AND status = 'completed' AND created_at >= ${since}) AS link_gmv,
      (SELECT count(*)::int FROM funnel_events WHERE event = 'guest_cart_merged' AND occurred_at >= ${since}) AS merges,
      (SELECT coalesce(sum((props->>'added')::int), 0)::int FROM funnel_events WHERE event = 'guest_cart_merged' AND occurred_at >= ${since}) AS merged_items,
      (SELECT count(DISTINCT g.user_id)::int FROM funnel_events g
         JOIN orders o ON o.user_id = g.user_id AND o.status = 'completed' AND o.total_amount > 0
           AND o.created_at >= g.occurred_at AND o.created_at < g.occurred_at + interval '7 days'
         WHERE g.event = 'guest_cart_merged' AND g.occurred_at >= ${since}) AS merged_paid
  `.execute(db);
  const h = helpers.rows[0];
  const teacherLinks = await sql<Row>`
    WITH items AS (
      SELECT coalesce(mt.teacher_id, co.teacher_id, dp.teacher_id) AS teacher_id,
        (oi.price_at_purchase - coalesce(oi.discount_amount, 0))::numeric AS net,
        oi.platform_fee_percentage::numeric AS fee,
        o.teacher_ref IS NOT NULL AS own, o.id AS order_id
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      LEFT JOIN mock_tests mt ON mt.id = oi.mock_test_id
      LEFT JOIN courses co ON co.id = oi.course_id
      LEFT JOIN digital_products dp ON dp.id = oi.digital_product_id
      WHERE o.status = 'completed' AND o.total_amount > 0 AND o.created_at >= ${since}
    )
    SELECT u.display_name AS teacher_name,
      count(DISTINCT order_id) FILTER (WHERE own)::int AS own_orders,
      coalesce(sum(net) FILTER (WHERE own), 0)::float AS own_gmv,
      coalesce(sum(net), 0)::float AS total_gmv,
      coalesce(sum(net * fee / 100) FILTER (WHERE own), 0)::float AS fee_now,
      coalesce(sum(net * 0.12) FILTER (WHERE own), 0)::float AS fee_at_twelve
    FROM items JOIN teachers u ON u.id = items.teacher_id
    GROUP BY u.id, u.display_name
    HAVING count(*) FILTER (WHERE own) > 0
    ORDER BY own_gmv DESC LIMIT 15
  `.execute(db);
  const messagesByKey = new Map(messageStats.rows.map((row) => [str(row, "playbook_key"), row]));
  const enrolmentByKey = new Map(enrolmentStats.rows.map((row) => [str(row, "playbook_key"), row]));
  let incremental = 0;
  let incrementalLow = 0;
  let incrementalHigh = 0;
  let incrementalEnough = false;
  const playbookRows = AUTOPILOT_PLAYBOOKS.map((playbook) => {
    const m = messagesByKey.get(playbook.key);
    const e = enrolmentByKey.get(playbook.key);
    const treated = num(e, "treated");
    const holdout = num(e, "holdout");
    const estimate = posteriorLift(
      { conversions: num(e, "treated_conv"), total: treated },
      { conversions: num(e, "holdout_conv"), total: holdout },
      { draws: 1000 }
    );
    if (playbook.goal === "paid_order" && estimate.enoughData) {
      incrementalEnough = true;
      incremental += estimate.lift * treated;
      incrementalLow += estimate.low * treated;
      incrementalHigh += estimate.high * treated;
    }
    return {
      key: playbook.key,
      label: playbook.label,
      goal: playbook.goal,
      enrolled: treated + holdout,
      holdout,
      treatedRate: estimate.treatedRate,
      holdoutRate: estimate.holdoutRate,
      lift: estimate.lift,
      liftLow: estimate.low,
      liftHigh: estimate.high,
      enoughData: estimate.enoughData,
      messages: num(m, "messages"),
      shadowMessages: num(m, "shadow_messages"),
      clicked: num(m, "clicked"),
      orders: num(m, "orders"),
      gmv: num(m, "gmv"),
    };
  });
  const replies = await sql<Row>`
    SELECT r.id, r.channel::text AS channel, r.body, r.received_at, u.display_name AS user_name, m.playbook_key
    FROM message_replies r
    LEFT JOIN accounts u ON u.id = r.user_id
    LEFT JOIN rev_messages m ON m.id = r.message_id
    ORDER BY r.received_at DESC LIMIT 10
  `.execute(db);
  return {
    days,
    trackingSince,
    tcoinOffers: AUTOPILOT_PLAYBOOKS.filter((playbook) => playbook.steps.some((step) => step.offer)).map((playbook) => ({
      key: playbook.key,
      label: playbook.label,
      expiryDays: offerExpiryDays(settings, playbook.key),
    })),
    settings: {
      enabled: settings.enabled,
      shadow: settings.shadow,
      holdoutPercent: settings.holdoutPercent,
      hasHoldoutSalt: settings.holdoutSalt.length > 0,
      aiProvider: settings.aiProvider,
      deepseekConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
    },
    kpis: {
      paidOrders: num(k, "paid_orders"),
      gmv: num(k, "gmv"),
      take: num(k, "take"),
      attributedOrders: num(k, "attributed_orders"),
      attributedGmv: num(k, "attributed_gmv"),
      attributedTake: num(k, "attributed_take"),
      messageCostRupees: num(costs.rows[0], "paise") / 100,
      offerCostRupees: num(offers.rows[0], "rupees"),
      messagesSent: num(costs.rows[0], "sent"),
    },
    coverage: { paidOrdersSinceTracking: num(coverage.rows[0], "total"), withSource: num(coverage.rows[0], "with_source") },
    funnel: [
      { key: "viewers", label: "Viewed an item", count: num(f, "viewers") },
      { key: "cart_clickers", label: "Clicked add to cart or buy", count: num(f, "cart_clickers") },
      { key: "signed_in", label: "Signed up or signed in", count: num(f, "signed_in") },
      { key: "checkout_users", label: "Started a paid checkout", count: num(f, "checkout_users") },
      { key: "paid_users", label: "Paid", count: num(f, "paid_users") },
    ],
    signedOutCartClicks: num(f, "wall_hits"),
    sources: sources.rows.map((row) => ({ source: str(row, "source"), orders: num(row, "orders"), gmv: num(row, "gmv") })),
    channels: channels.rows.map((row) => ({
      channel: str(row, "channel"),
      sent: num(row, "sent"),
      delivered: num(row, "delivered"),
      opened: num(row, "opened"),
      clicked: num(row, "clicked"),
      costRupees: num(row, "paise") / 100,
    })),
    playbooks: playbookRows,
    incremental: {
      conversions: Math.round(incremental * 10) / 10,
      low: Math.round(incrementalLow * 10) / 10,
      high: Math.round(incrementalHigh * 10) / 10,
      enoughData: incrementalEnough,
    },
    checkoutHelpers: {
      payLinksCreated: num(h, "links_created"),
      payLinksOpened: num(h, "links_opened"),
      payLinksPaid: num(h, "links_paid"),
      payLinkGmv: num(h, "link_gmv"),
      guestCartMerges: num(h, "merges"),
      guestCartItems: num(h, "merged_items"),
      guestCartPaidUsers: num(h, "merged_paid"),
    },
    teacherOwnLinks: teacherLinks.rows.map((row) => ({
      teacherName: str(row, "teacher_name"),
      ownOrders: num(row, "own_orders"),
      ownGmv: num(row, "own_gmv"),
      totalGmv: num(row, "total_gmv"),
      feeNow: num(row, "fee_now"),
      feeAtTwelve: num(row, "fee_at_twelve"),
    })),
    checks: checks.rows.map((row) => {
      const value = pick(row, "value");
      return {
        key: str(row, "check_key"),
        status: str(row, "status"),
        value: value === null || value === undefined ? null : Number(value),
        ranAt: new Date(String(pick(row, "ran_at"))),
        detail: pick(row, "detail") ?? null,
      };
    }),
    replies: replies.rows.map((row) => ({
      id: str(row, "id"),
      channel: str(row, "channel"),
      body: str(row, "body"),
      receivedAt: new Date(String(pick(row, "received_at"))),
      userName: (pick(row, "user_name") as string | null) ?? null,
      playbook: (pick(row, "playbook_key") as string | null) ?? null,
    })),
  };
}