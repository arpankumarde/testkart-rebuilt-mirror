import { sql } from "kysely";
import { db } from "./db";

/**
 * The autopilot's playbooks: who enters each (trigger SQL), what they get and
 * when (steps with two copy variants each), and what counts as success. The
 * engine (helpers/autopilotEngine) enrols, applies the guardrails and sends.
 * Copy stays honest: no fake urgency, offers only on the step marked offer.
 */

export type PlaybookContext = {
  firstName: string;
  itemTitle: string;
  amount: number;
  orderId?: number;
  slug?: string;
  examName?: string;
  examSlug?: string;
  mockTestId?: number;
  /** The item's thumbnail, shown as the WhatsApp image header when Meta can use it. */
  imageUrl?: string;
  /** free_to_paid: the free paper taken and its result, for the tk_test_result utility message. */
  testItemId?: number;
  paperTitle?: string;
  scoreText?: string;
  rankText?: string;
};

export type StepCopy = { subject: string; heading: string; body: string; cta: string };

export type PlaybookStep = {
  delayMinutes: number;
  offer?: boolean;
  /** coinsExpireOn is the offer coins' expiry date, ready to print. */
  variants: Record<"a" | "b", (ctx: PlaybookContext, coins: number, coinsExpireOn: string) => StepCopy>;
};

export type PlaybookTrigger = { userId: number; ref: string; at: Date; context: PlaybookContext };

export type Playbook = {
  key: string;
  label: string;
  /** The success the playbook is judged on, for the dashboard's lift. */
  goal: "paid_order" | "first_attempt";
  steps: PlaybookStep[];
  link: (ctx: PlaybookContext) => string;
  findTriggers: () => Promise<PlaybookTrigger[]>;
};

type Row = Record<string, unknown>;
const pick = (row: Row, snake: string): unknown =>
  snake in row ? row[snake] : row[snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())];
const text = (row: Row, key: string, fallback = "") => {
  const value = pick(row, key);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
};
const number = (row: Row, key: string) => Number(pick(row, key) ?? 0) || 0;

export const firstNameOf = (displayName: string | null | undefined) => {
  const name = (displayName ?? "").trim();
  if (!name || /^User_\d+$/.test(name)) return "there";
  return name.split(/\s+/)[0].slice(0, 30);
};

const inr = (value: number) => `Rs ${Math.round(value).toLocaleString("en-IN")}`;

/** The free paper's result for the tk_test_result message; empty when the score is missing or not a number. */
export function resultContext(row: Row): Pick<PlaybookContext, "testItemId" | "paperTitle" | "scoreText" | "rankText"> {
  const raw = pick(row, "score");
  const score = raw === null || raw === undefined ? NaN : Number(raw);
  const takers = number(row, "takers");
  const paperOnly = text(row, "paper_title");
  const series = text(row, "item_title");
  const paper = paperOnly.length < 20 && series ? `${paperOnly} - ${series}` : paperOnly;
  if (!Number.isFinite(score) || takers < 1 || !paperOnly) return {};
  const rank = Math.min(takers, number(row, "ahead") + 1);
  return {
    testItemId: number(row, "test_item_id") || undefined,
    paperTitle: paper.slice(0, 120),
    scoreText: `${Math.round(score * 10) / 10}%`,
    rankText: `${rank.toLocaleString("en-IN")} of ${takers.toLocaleString("en-IN")} ${takers === 1 ? "student" : "students"}`,
  };
}
const coinsLine = (coins: number, expireOn: string) =>
  coins > 0 ? ` We've added ${coins} Tcoins to your account, usable on this order at checkout until ${expireOn}.` : "";

const failedPayment: Playbook = {
  key: "failed_payment",
  label: "Failed payment rescue",
  goal: "paid_order",
  link: (ctx) => (ctx.orderId ? `/order/${ctx.orderId}` : "/cart"),
  steps: [
    {
      delayMinutes: 15,
      variants: {
        a: (ctx) => ({
          subject: "Your payment didn't go through",
          heading: `Hi ${ctx.firstName}, your payment didn't complete`,
          body: `Your payment of ${inr(ctx.amount)} for ${ctx.itemTitle} did not go through, so no money was taken. You can try again in a minute.`,
          cta: "Complete my order",
        }),
        b: (ctx) => ({
          subject: `${ctx.itemTitle} is still waiting for you`,
          heading: `Hi ${ctx.firstName}, pick up where you left off`,
          body: `It looks like the payment for ${ctx.itemTitle} stopped halfway. UPI usually works best; it takes under a minute.`,
          cta: "Try the payment again",
        }),
      },
    },
    {
      delayMinutes: 6 * 60,
      variants: {
        a: (ctx) => ({
          subject: "Need help with your payment?",
          heading: "Payments fail for simple reasons",
          body: `A bank timeout or a closed UPI app is the usual cause. Your order for ${ctx.itemTitle} (${inr(ctx.amount)}) is saved. If it keeps failing, reply to this email and we'll help.`,
          cta: "Retry my order",
        }),
        b: (ctx) => ({
          subject: `Still preparing with ${ctx.itemTitle}?`,
          heading: `${ctx.firstName}, your order is saved`,
          body: `You can finish your order for ${ctx.itemTitle} anytime. Paying by UPI or wallet is the quickest way.`,
          cta: "Finish my order",
        }),
      },
    },
    {
      delayMinutes: 24 * 60,
      offer: true,
      variants: {
        a: (ctx, coins, coinsExpireOn) => ({
          subject: "A little help to finish your order",
          heading: `${ctx.firstName}, here's something for your order`,
          body: `Your order for ${ctx.itemTitle} is still open.${coinsLine(coins, coinsExpireOn)}`,
          cta: "Complete my order",
        }),
        b: (ctx, coins, coinsExpireOn) => ({
          subject: `Last reminder about ${ctx.itemTitle}`,
          heading: "We won't remind you again",
          body: `This is our last note about your order for ${ctx.itemTitle}.${coinsLine(coins, coinsExpireOn)}`,
          cta: "Complete my order",
        }),
      },
    },
  ],
  findTriggers: async () => {
    const result = await sql<Row>`
      SELECT o.id AS order_id, o.user_id, o.updated_at AS at, o.total_amount, u.display_name,
        coalesce(
          (SELECT mt.title FROM order_items oi JOIN mock_tests mt ON mt.id = oi.mock_test_id WHERE oi.order_id = o.id LIMIT 1),
          (SELECT c.title FROM order_items oi JOIN courses c ON c.id = oi.course_id WHERE oi.order_id = o.id LIMIT 1),
          (SELECT d.title FROM order_items oi JOIN digital_products d ON d.id = oi.digital_product_id WHERE oi.order_id = o.id LIMIT 1),
          (SELECT b.title FROM course_bundles b WHERE b.id = o.bundle_id),
          'your Testkart order') AS item_title,
        coalesce(
          (SELECT mt.thumbnail_url FROM order_items oi JOIN mock_tests mt ON mt.id = oi.mock_test_id WHERE oi.order_id = o.id LIMIT 1),
          (SELECT coalesce(c.thumbnail_url, c.thumbnail_image_url) FROM order_items oi JOIN courses c ON c.id = oi.course_id WHERE oi.order_id = o.id LIMIT 1),
          (SELECT d.thumbnail_url FROM order_items oi JOIN digital_products d ON d.id = oi.digital_product_id WHERE oi.order_id = o.id LIMIT 1),
          (SELECT b.thumbnail_url FROM course_bundles b WHERE b.id = o.bundle_id)) AS image_url
      FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.status IN ('failed', 'cancelled') AND o.total_amount > 0 AND o.payment_method = 'payu'
        AND o.updated_at > now() - interval '6 hours' AND u.role = 'student'
        AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.user_id = o.user_id AND p.status IN ('completed', 'pending')
                          AND p.total_amount > 0 AND p.created_at > o.created_at)
        AND NOT EXISTS (SELECT 1 FROM rev_enrolments e WHERE e.user_id = o.user_id AND e.playbook_key = 'failed_payment'
                          AND e.created_at > now() - interval '7 days')
      ORDER BY o.id DESC LIMIT 200
    `.execute(db);
    return result.rows.map((row) => ({
      userId: number(row, "user_id"),
      ref: `order:${number(row, "order_id")}`,
      at: new Date(String(pick(row, "at"))),
      context: {
        firstName: firstNameOf(text(row, "display_name")),
        itemTitle: text(row, "item_title", "your Testkart order"),
        amount: number(row, "total_amount"),
        orderId: number(row, "order_id"),
        imageUrl: text(row, "image_url") || undefined,
      },
    }));
  },
};

const cartAbandoned: Playbook = {
  key: "cart_abandoned",
  label: "Cart abandoned",
  goal: "paid_order",
  link: () => "/cart",
  steps: [
    {
      delayMinutes: 60,
      variants: {
        a: (ctx) => ({
          subject: "You left something in your cart",
          heading: `Hi ${ctx.firstName}, your cart is saved`,
          body: `${ctx.itemTitle} is waiting in your cart (${inr(ctx.amount)}). Checkout takes under a minute with UPI.`,
          cta: "Go to my cart",
        }),
        b: (ctx) => ({
          subject: `Ready to start ${ctx.itemTitle}?`,
          heading: "Your next mock test is one step away",
          body: `You added ${ctx.itemTitle} to your cart. Finish checkout and start practising today.`,
          cta: "Finish checkout",
        }),
      },
    },
    {
      delayMinutes: 20 * 60,
      variants: {
        a: (ctx) => ({
          subject: "Still thinking it over?",
          heading: "Most aspirants start with one full mock",
          body: `${ctx.itemTitle} is in your cart. Try a test, see your score and decide from there.`,
          cta: "View my cart",
        }),
        b: (ctx) => ({
          subject: "Questions before you buy?",
          heading: `${ctx.firstName}, we're happy to help`,
          body: `If anything about ${ctx.itemTitle} is unclear, reply to this email. Your cart stays saved.`,
          cta: "View my cart",
        }),
      },
    },
    {
      delayMinutes: 48 * 60,
      offer: true,
      variants: {
        a: (ctx, coins, coinsExpireOn) => ({
          subject: "Something for your cart",
          heading: `${ctx.firstName}, here's a little help`,
          body: `${ctx.itemTitle} is still in your cart.${coinsLine(coins, coinsExpireOn)}`,
          cta: "Go to my cart",
        }),
        b: (ctx, coins, coinsExpireOn) => ({
          subject: "Last note about your cart",
          heading: "We won't remind you again",
          body: `This is our last reminder about ${ctx.itemTitle}.${coinsLine(coins, coinsExpireOn)}`,
          cta: "Go to my cart",
        }),
      },
    },
  ],
  findTriggers: async () => {
    const result = await sql<Row>`
      SELECT c.user_id, c.last_added, c.first_added, c.item_title, c.image_url, c.amount, u.display_name
      FROM (
        SELECT ci.user_id, max(ci.added_at) AS last_added, min(ci.added_at) AS first_added,
          (array_agg(coalesce(mt.title, co.title, dp.title) ORDER BY ci.added_at DESC))[1] AS item_title,
          (array_agg(coalesce(mt.thumbnail_url, co.thumbnail_url, co.thumbnail_image_url, dp.thumbnail_url) ORDER BY ci.added_at DESC))[1] AS image_url,
          sum(coalesce(mt.discount_price, mt.price, co.discount_price, co.price, dp.discount_price, dp.price, 0)) AS amount
        FROM cart_items ci
        LEFT JOIN mock_tests mt ON mt.id = ci.mock_test_id
        LEFT JOIN courses co ON co.id = ci.course_id
        LEFT JOIN digital_products dp ON dp.id = ci.digital_product_id
        GROUP BY ci.user_id
      ) c JOIN users u ON u.id = c.user_id
      WHERE u.role = 'student' AND c.last_added < now() - interval '1 hour' AND c.last_added > now() - interval '48 hours'
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = c.user_id AND o.created_at > c.first_added)
        AND NOT EXISTS (SELECT 1 FROM rev_enrolments e WHERE e.user_id = c.user_id AND e.playbook_key = 'cart_abandoned'
                          AND e.created_at > now() - interval '7 days')
      LIMIT 300
    `.execute(db);
    return result.rows.map((row) => {
      const last = new Date(String(pick(row, "last_added")));
      return {
        userId: number(row, "user_id"),
        ref: `cart:${number(row, "user_id")}:${last.toISOString().slice(0, 10)}`,
        at: last,
        context: {
          firstName: firstNameOf(text(row, "display_name")),
          itemTitle: text(row, "item_title", "your test series"),
          amount: number(row, "amount"),
          imageUrl: text(row, "image_url") || undefined,
        },
      };
    });
  },
};

const onboarding: Playbook = {
  key: "onboarding",
  label: "New student onboarding",
  goal: "first_attempt",
  link: (ctx) => (ctx.examSlug ? `/exams/${ctx.examSlug}/mock-tests` : "/mock-test"),
  steps: [
    {
      delayMinutes: 60,
      variants: {
        a: (ctx) => ({
          subject: ctx.examName ? `Your free ${ctx.examName} mock test is ready` : "Your first free mock test is ready",
          heading: `Welcome to Testkart, ${ctx.firstName}`,
          body: `Start with a free full-length mock${ctx.examName ? ` for ${ctx.examName}` : ""}. You'll see your score and every solution as soon as you submit.`,
          cta: "Take a free mock test",
        }),
        b: (ctx) => ({
          subject: "Start with one free test",
          heading: `${ctx.firstName}, see where you stand today`,
          body: `One free mock${ctx.examName ? ` for ${ctx.examName}` : ""} tells you more than a week of reading. It takes about an hour.`,
          cta: "Start a free test",
        }),
      },
    },
    {
      delayMinutes: 24 * 60,
      variants: {
        a: (ctx) => ({
          subject: "Thousands of aspirants take these tests",
          heading: "See how you compare",
          body: `Take a free mock${ctx.examName ? ` for ${ctx.examName}` : ""} and find out where you stand among other aspirants.`,
          cta: "Take a free mock test",
        }),
        b: (ctx) => ({
          subject: "Your free test is still waiting",
          heading: `${ctx.firstName}, ready when you are`,
          body: "Pick any free mock, attempt it in one sitting and check your weak sections right after.",
          cta: "Browse free tests",
        }),
      },
    },
    {
      delayMinutes: 3 * 24 * 60,
      variants: {
        a: (ctx) => ({
          subject: "One test a week makes a difference",
          heading: "Small steps, steady scores",
          body: `Aspirants who test weekly improve faster. Start with a free mock${ctx.examName ? ` for ${ctx.examName}` : ""} today.`,
          cta: "Start practising",
        }),
        b: () => ({
          subject: "Free notes and tests for your exam",
          heading: "Everything to get started is free",
          body: "Free mock tests, previous-year papers and study notes are waiting in your account.",
          cta: "See free material",
        }),
      },
    },
  ],
  findTriggers: async () => {
    const result = await sql<Row>`
      SELECT u.id AS user_id, u.created_at AS at, u.display_name,
        (SELECT e.exam_name FROM user_exam_focus f JOIN exams e ON e.id = f.exam_id WHERE f.user_id = u.id ORDER BY f.position LIMIT 1) AS exam_name,
        (SELECT e.exam_slug FROM user_exam_focus f JOIN exams e ON e.id = f.exam_id WHERE f.user_id = u.id ORDER BY f.position LIMIT 1) AS exam_slug
      FROM users u
      WHERE u.role = 'student' AND u.created_at > now() - interval '24 hours' AND u.created_at < now() - interval '30 minutes'
        AND NOT EXISTS (SELECT 1 FROM test_attempts t WHERE t.student_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.status = 'completed' AND o.total_amount > 0)
      LIMIT 500
    `.execute(db);
    return result.rows.map((row) => ({
      userId: number(row, "user_id"),
      ref: `signup:${number(row, "user_id")}`,
      at: new Date(String(pick(row, "at"))),
      context: {
        firstName: firstNameOf(text(row, "display_name")),
        itemTitle: "",
        amount: 0,
        examName: text(row, "exam_name") || undefined,
        examSlug: text(row, "exam_slug") || undefined,
      },
    }));
  },
};

const freeToPaid: Playbook = {
  key: "free_to_paid",
  label: "Free test to paid series",
  goal: "paid_order",
  link: (ctx) => (ctx.slug ? `/mock-test/${ctx.slug}` : "/mock-test"),
  steps: [
    {
      delayMinutes: 24 * 60,
      variants: {
        a: (ctx) => ({
          subject: "Your free test is done. What's next?",
          heading: `Good work on the free test, ${ctx.firstName}`,
          body: `The full ${ctx.itemTitle} has more papers at the same level, with solutions and your rank on each.`,
          cta: "See the full series",
        }),
        b: (ctx) => ({
          subject: "Keep the momentum going",
          heading: "One free test is a start",
          body: `Regular full-length practice is what moves scores. ${ctx.itemTitle} gives you the next papers in order.`,
          cta: "Continue the series",
        }),
      },
    },
    {
      delayMinutes: 4 * 24 * 60,
      offer: true,
      variants: {
        a: (ctx, coins, coinsExpireOn) => ({
          subject: `Something to help you start ${ctx.itemTitle}`,
          heading: `${ctx.firstName}, ready for the full series?`,
          body: `You've already tried a paper from ${ctx.itemTitle} (${inr(ctx.amount)}).${coinsLine(coins, coinsExpireOn)}`,
          cta: "Get the full series",
        }),
        b: (ctx, coins, coinsExpireOn) => ({
          subject: "Your next mock tests",
          heading: "Pick up the full series",
          body: `${ctx.itemTitle} continues where your free paper stopped.${coinsLine(coins, coinsExpireOn)}`,
          cta: "Get the full series",
        }),
      },
    },
  ],
  findTriggers: async () => {
    const result = await sql<Row>`
      SELECT DISTINCT ON (t.student_id) t.student_id AS user_id, t.completed_at AS at, u.display_name,
        mt.id AS mock_test_id, mt.slug, mt.title AS item_title, mt.thumbnail_url AS image_url, coalesce(mt.discount_price, mt.price) AS amount,
        i.id AS test_item_id, i.title AS paper_title, CASE WHEN t.score <> 'NaN' THEN t.score END AS score,
        (SELECT count(DISTINCT x.student_id) FROM test_attempts x
          WHERE x.test_id = t.test_id AND x.completed_at IS NOT NULL AND x.score IS NOT NULL AND x.score <> 'NaN') AS takers,
        (SELECT count(DISTINCT x.student_id) FROM test_attempts x
          WHERE x.test_id = t.test_id AND x.completed_at IS NOT NULL AND x.score <> 'NaN' AND x.score > t.score
            AND x.student_id <> t.student_id) AS ahead
      FROM test_attempts t
      JOIN mock_test_items i ON i.id = t.test_id
      JOIN mock_tests mt ON mt.id = i.package_id
      JOIN users u ON u.id = t.student_id
      WHERE u.role = 'student' AND i.is_free = true AND mt.is_published = true AND mt.deleted_at IS NULL
        AND coalesce(mt.discount_price, mt.price) > 0
        AND t.completed_at > now() - interval '24 hours' AND t.completed_at < now() - interval '30 minutes'
        AND NOT EXISTS (SELECT 1 FROM live_tests lt WHERE lt.mock_test_id = mt.id)
        AND NOT EXISTS (SELECT 1 FROM mock_test_enrollments me WHERE me.student_id = t.student_id AND me.mock_test_id = mt.id)
      ORDER BY t.student_id, t.completed_at DESC
      LIMIT 500
    `.execute(db);
    return result.rows.map((row) => ({
      userId: number(row, "user_id"),
      ref: `free:${number(row, "user_id")}:${number(row, "mock_test_id")}`,
      at: new Date(String(pick(row, "at"))),
      context: {
        firstName: firstNameOf(text(row, "display_name")),
        itemTitle: text(row, "item_title", "the full series"),
        amount: number(row, "amount"),
        slug: text(row, "slug") || undefined,
        mockTestId: number(row, "mock_test_id"),
        imageUrl: text(row, "image_url") || undefined,
        ...resultContext(row),
      },
    }));
  },
};

const repeatPurchase: Playbook = {
  key: "repeat_purchase",
  label: "Repeat purchase",
  goal: "paid_order",
  link: (ctx) => (ctx.slug ? `/mock-test/${ctx.slug}` : "/mock-test"),
  steps: [
    {
      delayMinutes: 0,
      variants: {
        a: (ctx) => ({
          subject: `Aspirants who bought your series also take ${ctx.itemTitle}`,
          heading: `${ctx.firstName}, more practice for the same exam`,
          body: `${ctx.itemTitle} is popular with students preparing for the same exam as you.`,
          cta: "Have a look",
        }),
        b: (ctx) => ({
          subject: "Your next set of papers",
          heading: "Different papers, new questions",
          body: `${ctx.itemTitle} covers the same exam with fresh papers, a good way to avoid repeating questions you've seen.`,
          cta: "See the series",
        }),
      },
    },
  ],
  findTriggers: async () => {
    const result = await sql<Row>`
      SELECT o.user_id, o.id AS order_id, o.created_at AS at, u.display_name, rec.slug, rec.title AS item_title, rec.image_url, rec.amount
      FROM orders o JOIN users u ON u.id = o.user_id
      JOIN LATERAL (
        SELECT mt2.slug, mt2.title, mt2.thumbnail_url AS image_url, coalesce(mt2.discount_price, mt2.price) AS amount
        FROM order_items oi
        JOIN mock_tests mt ON mt.id = oi.mock_test_id
        JOIN mock_tests mt2 ON mt2.exam_id = mt.exam_id AND mt2.id <> mt.id
        WHERE oi.order_id = o.id AND mt2.is_published = true AND mt2.deleted_at IS NULL
          AND coalesce(mt2.discount_price, mt2.price) > 0
          AND NOT EXISTS (SELECT 1 FROM live_tests lt WHERE lt.mock_test_id = mt2.id)
          AND NOT EXISTS (SELECT 1 FROM mock_test_enrollments me WHERE me.student_id = o.user_id AND me.mock_test_id = mt2.id)
        ORDER BY mt2.students_enrolled DESC NULLS LAST LIMIT 1
      ) rec ON true
      WHERE o.status = 'completed' AND o.total_amount > 0 AND u.role = 'student'
        AND o.created_at < now() - interval '3 days' AND o.created_at > now() - interval '4 days'
        AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.user_id = o.user_id AND p.status = 'completed'
                          AND p.total_amount > 0 AND p.created_at > o.created_at)
      LIMIT 300
    `.execute(db);
    return result.rows.map((row) => ({
      userId: number(row, "user_id"),
      ref: `repeat:${number(row, "order_id")}`,
      at: new Date(),
      context: {
        firstName: firstNameOf(text(row, "display_name")),
        itemTitle: text(row, "item_title", "another test series"),
        amount: number(row, "amount"),
        slug: text(row, "slug") || undefined,
        imageUrl: text(row, "image_url") || undefined,
      },
    }));
  },
};

export const AUTOPILOT_PLAYBOOKS: Playbook[] = [failedPayment, cartAbandoned, onboarding, freeToPaid, repeatPurchase];

export const AUTOPILOT_PLAYBOOK_LABELS: Record<string, string> = Object.fromEntries(
  AUTOPILOT_PLAYBOOKS.map((playbook) => [playbook.key, playbook.label])
);