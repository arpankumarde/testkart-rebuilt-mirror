import { Helmet } from "react-helmet";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Minus, Plus } from "lucide-react";
import { useTeacherBulkMutations } from "../helpers/useTeacherBulkMutations";
import { TeacherAIFillPanel } from "../components/TeacherAIFillPanel";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { AIRewriteButton } from "../components/AIRewriteButton";
import { TestSeriesSteps } from "../components/TestSeriesSteps";
import { useExamNameSuggestions } from "../helpers/useExamNameSuggestions";
import { addSuggestedExam } from "../helpers/itemExams";
import { itemLanguages } from "../helpers/itemLanguages";
import { noEmoji } from "../helpers/emojiText";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useForm,
} from "../components/Form";
import type { InputType as CreateInput } from "../endpoints/teacher/tests/create-with-items_POST.schema";
import styles from "./teacher.create-test.module.css";

const QUICK_TEST_COUNTS = [1, 5, 10, 20];

const startSchema = z.object({
  title: noEmoji(z.string().trim().min(3, "Use at least 3 characters.")),
  itemCount: z
    .number({ invalid_type_error: "Enter how many tests to start with." })
    .int()
    .min(1, "Start with at least 1 test.")
    .max(50, "Start with 50 tests or fewer."),
});

type AiExtras = Pick<CreateInput, "description" | "examName" | "examNames" | "languages" | "price">;

/*
 * The first page of the Tests step. A series needs a saved id before tests and
 * questions can be added, so this only names it and sets how many empty tests
 * to start with. Exams, languages, price and storefront copy come in Details,
 * after the questions. Anything Fill with AI suggests for those is saved with
 * the series now and shows up there.
 */
export default function CreateTestPage() {
  const navigate = useNavigate();
  const [aiExtras, setAiExtras] = useState<AiExtras | null>(null);
  const { officialExams } = useExamNameSuggestions();

  const { useCreateTestWithItemsMutation } = useTeacherBulkMutations();
  const createTestMutation = useCreateTestWithItemsMutation();

  const form = useForm({
    defaultValues: { title: "", itemCount: 1 },
    schema: startSchema,
  });

  const applyAi = (aiData: any) => {
    if (!aiData) return;
    const examNames = addSuggestedExam([], aiData.examName, officialExams);
    const description: string | undefined =
      aiData.shortDescription || (aiData.description ? String(aiData.description).slice(0, 200) : undefined);
    setAiExtras({
      description: description ? description.slice(0, 200) : undefined,
      examName: examNames[0] ?? null,
      examNames,
      languages: aiData.language ? itemLanguages({ language: aiData.language }) : undefined,
      price: typeof aiData.suggestedPrice === "number" && aiData.suggestedPrice > 0 ? aiData.suggestedPrice : undefined,
    });
    if (aiData.title) form.setValues((p) => ({ ...p, title: aiData.title }));
  };

  const onSubmit = (values: z.infer<typeof startSchema>) => {
    createTestMutation.mutate(
      { ...aiExtras, title: values.title.trim(), itemCount: values.itemCount },
      {
        onSuccess: (data) => {
          navigate(`/teacher/create-test/${data.id}/test-items`, { replace: true });
        },
      }
    );
  };

  const itemCount = Number(form.values.itemCount) || 0;
  const setItemCount = (next: number) =>
    form.setValues((prev) => ({ ...prev, itemCount: Math.min(50, Math.max(1, next)) }));

  return (
    <>
      <Helmet>
        <title>Create a test series - Testkart for Teachers</title>
        <meta
          name="description"
          content="Build and customize a new mock test series for your students on Testkart."
        />
      </Helmet>
      <div className={`${styles.container} tk-flow`}>
        <TestSeriesSteps current="tests" back="/teacher/test-series" />
        <h1 className={styles.srOnly}>Create a test series</h1>

        <TeacherAIFillPanel
          contentType="test"
          fills="title, plus the exam, language and price for Details"
          placeholder="e.g., 20 full mocks for SSC CGL Tier 1 in English and Hindi, latest pattern"
          onGenerated={applyAi}
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Tests in this series</h2>
                <span className={styles.sectionHint}>Name the series and pick how many tests it starts with.</span>
              </div>

              <FormItem name="title">
                <div className={styles.labelWithAI}>
                  <FormLabel>Series title</FormLabel>
                  <AIRewriteButton
                    field="title"
                    contentType="test"
                    currentValue={form.values.title}
                    context={{ title: form.values.title }}
                    onAccept={(suggestion) => form.setValues((p) => ({ ...p, title: suggestion }))}
                  />
                </div>
                <FormControl>
                  <Input
                    placeholder="e.g., SSC CGL Tier 1 Full Mock Tests"
                    value={form.values.title}
                    onChange={(e) => form.setValues((p) => ({ ...p, title: e.target.value }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="itemCount">
                <FormLabel>Number of tests</FormLabel>
                <div className={styles.countRow}>
                  <div className={styles.counter}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-md"
                      onClick={() => setItemCount(itemCount - 1)}
                      disabled={itemCount <= 1}
                      aria-label="One test fewer"
                    >
                      <Minus size={16} />
                    </Button>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        className={styles.counterInput}
                        value={form.values.itemCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          form.setValues((prev) => ({
                            ...prev,
                            itemCount: isNaN(val) ? ("" as any) : val,
                          }));
                        }}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-md"
                      onClick={() => setItemCount(itemCount + 1)}
                      disabled={itemCount >= 50}
                      aria-label="One test more"
                    >
                      <Plus size={16} />
                    </Button>
                  </div>
                  <div className={styles.quickCounts} aria-label="Quick picks">
                    {QUICK_TEST_COUNTS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={styles.quickCount}
                        aria-pressed={itemCount === n}
                        onClick={() => setItemCount(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <FormDescription>
                  We will create {itemCount > 0 ? itemCount : "these"}{" "}
                  {itemCount === 1 ? "empty test" : "empty tests"}, named Test 1, Test 2 and so on.
                  You can rename them and add more on the next page.
                </FormDescription>
                <FormMessage />
              </FormItem>
            </section>

            <ol className={styles.nextList} aria-label="What comes next">
              <li>
                <span className={styles.nextNum}>1</span>
                <span>
                  <strong>Tests and questions.</strong> Rename the tests, then add questions to each one.
                </span>
              </li>
              <li>
                <span className={styles.nextNum}>2</span>
                <span>
                  <strong>Details.</strong> Exams, languages, price, short bio and thumbnail.
                  {aiExtras && " Your Fill with AI suggestions are waiting there."}
                </span>
              </li>
              <li>
                <span className={styles.nextNum}>3</span>
                <span>
                  <strong>Publish.</strong> Check everything and send it for review.
                </span>
              </li>
            </ol>

            {createTestMutation.isError && (
              <div className={styles.error} role="alert">
                The series could not be created. Nothing was saved. Check the fields above and try again.
              </div>
            )}

            <div className={styles.actions}>
              <p className={styles.actionsNote}>Nothing goes live until you publish it.</p>
              <Button type="submit" disabled={createTestMutation.isPending}>
                {createTestMutation.isPending ? "Creating..." : "Start adding tests"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </>
  );
}
