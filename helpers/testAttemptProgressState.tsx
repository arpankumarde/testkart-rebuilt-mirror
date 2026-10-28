import { z } from "zod";

// An open test attempt as the web player saves it (a paused mock test, or a
// live test in progress). The server stores it as is and hands it back on
// resume; scoring still only reads submit-attempt.
const optionSchema = z.enum(["A", "B", "C", "D", "E"]);

const savedAnswerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("single"), value: optionSchema }),
  z.object({ type: z.literal("multiple"), value: z.array(optionSchema).max(5) }),
  z.object({ type: z.literal("numerical"), value: z.number().finite() }),
  z.object({ type: z.literal("match"), value: z.record(z.string().max(200), z.string().max(200)) }),
]);

const idList = z.array(z.number().int().positive()).max(2000);
const seconds = z.number().int().min(0).max(30 * 24 * 3600);

export const attemptProgressStateSchema = z.object({
  v: z.literal(1),
  answers: z.array(z.tuple([z.number().int().positive(), savedAnswerSchema])).max(2000),
  currentQuestionId: z.number().int().positive().nullable(),
  markedForReview: idList,
  visitedQuestionIds: idList,
  timeRemaining: seconds,
  subjectTimerStates: z.record(
    z.string().max(300),
    z.object({ remaining: seconds, submitted: z.boolean() })
  ),
  activeSubjectName: z.string().max(300),
  expiredQuestionIds: idList,
  questionTimerSeconds: seconds.nullable(),
});

export type AttemptProgressState = z.infer<typeof attemptProgressStateSchema>;

export function emptyProgressState(timeRemaining: number): AttemptProgressState {
  return {
    v: 1,
    answers: [],
    currentQuestionId: null,
    markedForReview: [],
    visitedQuestionIds: [],
    timeRemaining: Math.max(0, Math.round(timeRemaining)),
    subjectTimerStates: {},
    activeSubjectName: "",
    expiredQuestionIds: [],
    questionTimerSeconds: null,
  };
}

/** jsonb rows can come back as a string when an older writer stringified them. */
export function parseStoredProgressState(value: unknown): AttemptProgressState | null {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const parsed = attemptProgressStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}