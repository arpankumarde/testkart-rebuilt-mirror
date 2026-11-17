import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { LiveTestSteps } from "../components/LiveTestGuidedForm";
import { TeacherAIFillPanel, type TeacherAIFillValues } from "../components/TeacherAIFillPanel";
import { AIRewriteButton } from "../components/AIRewriteButton";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage, useForm } from "../components/Form";
import { useTeacherLiveTestMutations } from "../helpers/useTeacherLiveTestMutations";
import { itemLanguages } from "../helpers/itemLanguages";
import { noEmoji } from "../helpers/emojiText";
import type { InputType as CreateLiveTestInput } from "../endpoints/teacher/live-tests/create_POST.schema";
import styles from "./teacher.create-live-test.module.css";

const DAY = 24 * 60 * 60 * 1000;

type TimerMode = "whole" | "subject" | "question";

const TIMER_OPTIONS: { mode: TimerMode; title: string; hint: string }[] = [
  { mode: "whole", title: "Whole test", hint: "One timer for the full paper" },
  { mode: "subject", title: "Per subject", hint: "Each subject gets its own time" },
  { mode: "question", title: "Per question", hint: "Each question gets its own time" },
];

const startSchema = z.object({
  title: noEmoji(z.string().trim().min(3, "Use at least 3 characters.").max(100, "Keep it to 100 characters.")),
});

/*
 * The first page of the Questions step. Questions need a saved live test, so
 * this only names it and picks the timer, which decides how questions are
 * timed in the builder. The test is saved as a draft with placeholder timing,
 * price and seats (plus anything Fill with AI suggested); the teacher sets
 * those for real in Details, after the questions, and nothing goes live until
 * Publish.
 */
const CreateLiveTestPage: React.FC = () => {
  const navigate = useNavigate();
  const [timer, setTimer] = useState<TimerMode>("whole");
  const [aiValues, setAiValues] = useState<TeacherAIFillValues | null>(null);
  const { useCreateLiveTestMutation } = useTeacherLiveTestMutations();
  const createLiveTest = useCreateLiveTestMutation();

  const form = useForm({ schema: startSchema, defaultValues: { title: "" } });

  const applyAi = (values: TeacherAIFillValues) => {
    setAiValues(values);
    if (values.title) form.setValues((p) => ({ ...p, title: values.title }));
  };

  const onSubmit = (values: z.infer<typeof startSchema>) => {
    const examName = aiValues?.examName?.trim() || null;
    const payload: CreateLiveTestInput = {
      title: values.title.trim(),
      description: aiValues?.description || null,
      examName,
      examNames: examName ? [examName] : [],
      languages: aiValues?.language ? itemLanguages({ language: aiValues.language }) : [],
      durationMinutes: aiValues?.durationMinutes || 60,
      subjectWiseTiming: timer === "subject",
      questionWiseTiming: timer === "question",
      calculatorEnabled: false,
      price: aiValues?.suggestedPrice && aiValues.suggestedPrice > 0 ? aiValues.suggestedPrice : 0,
      discountPrice: null,
      isFree: false,
      maxSeats: 100,
      startTime: null,
      endTime: new Date(Date.now() + 7 * DAY),
      registrationDeadline: null,
      hasPrizes: false,
      prizeTiers: [],
    };
    createLiveTest.mutate(payload, {
      onSuccess: (result) => navigate(`/teacher/live-test/${result.id}/questions`, { replace: true }),
    });
  };

  return (
    <>
      <Helmet>
        <title>Create Live Test | Teacher Dashboard | Testkart</title>
        <meta
          name="description"
          content="Schedule and create a new live test event for your students on Testkart."
        />
      </Helmet>

      <div className={`${styles.page} tk-flow`}>
        <LiveTestSteps current="questions" back="/teacher/live-tests" />
        <h1 className={styles.srOnly}>Create a live test</h1>

        <TeacherAIFillPanel
          contentType="liveTest"
          fills="title, plus the description, exam, price and length for Details"
          placeholder="e.g., SSC CGL Tier 1 live mock, 100 questions in 60 minutes, this Sunday evening"
          onGenerated={applyAi}
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={styles.start}>
            <section className={styles.section} aria-labelledby="live-start-title">
              <div className={styles.sectionHead}>
                <h2 id="live-start-title" className={styles.sectionTitle}>The paper</h2>
                <span className={styles.sectionHint}>Name the test and pick how it is timed, then add questions.</span>
              </div>

              <FormItem name="title">
                <div className={styles.labelRow}>
                  <FormLabel>Live test title</FormLabel>
                  <AIRewriteButton
                    field="title"
                    contentType="liveTest"
                    currentValue={form.values.title}
                    context={{ examName: aiValues?.examName }}
                    onAccept={(suggestion) => form.setValues((p) => ({ ...p, title: suggestion }))}
                  />
                </div>
                <FormControl>
                  <Input
                    value={form.values.title}
                    onChange={(e) => form.setValues((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g., SSC CGL Sunday Live Mock"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="timer">
                <FormLabel>Timer</FormLabel>
                <div className={styles.choiceGroup} role="radiogroup" aria-label="Timer">
                  {TIMER_OPTIONS.map((option) => (
                    <button
                      key={option.mode}
                      type="button"
                      role="radio"
                      aria-checked={timer === option.mode}
                      className={styles.choice}
                      onClick={() => setTimer(option.mode)}
                    >
                      <span className={styles.choiceTitle}>{option.title}</span>
                      <span className={styles.choiceHint}>{option.hint}</span>
                    </button>
                  ))}
                </div>
                <FormDescription>Most tests use one timer for the whole paper. You can change this in Details.</FormDescription>
              </FormItem>
            </section>

            <ol className={styles.nextList} aria-label="What comes next">
              <li>
                <span className={styles.nextNum}>1</span>
                <span>
                  <strong>Questions.</strong> Build the paper, subject by subject.
                </span>
              </li>
              <li>
                <span className={styles.nextNum}>2</span>
                <span>
                  <strong>Details.</strong> Exams, schedule, length, price, seats, prizes and storefront.
                  {aiValues && " Your Fill with AI suggestions are waiting there."}
                </span>
              </li>
              <li>
                <span className={styles.nextNum}>3</span>
                <span>
                  <strong>Publish.</strong> Check everything and send it live.
                </span>
              </li>
            </ol>

            {createLiveTest.isError && (
              <div className={styles.error} role="alert">
                The live test could not be created. Nothing was saved. Check the title and try again.
              </div>
            )}

            <div className={styles.actions}>
              <p className={styles.actionsNote}>Nothing goes live until you publish it.</p>
              <Button type="submit" disabled={createLiveTest.isPending}>
                {createLiveTest.isPending ? "Creating..." : "Start adding questions"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </>
  );
};

export default CreateLiveTestPage;
