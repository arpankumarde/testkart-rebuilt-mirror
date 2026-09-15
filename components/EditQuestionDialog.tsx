import React, { useState } from "react";
import { Edit } from "lucide-react";
import { z } from "zod";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { RichTextEditor } from "./RichTextEditor";
import { Dialog, DialogTrigger } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { Form, FormControl, FormItem, FormLabel, FormMessage, useForm } from "./Form";
import { useUpdateAIQuestion } from "../helpers/useAdminAIQuestions";
import { AIQuestionListItem } from "../endpoints/admin/ai-questions/list_GET.schema";
import { schema as updateSchema } from "../endpoints/admin/ai-questions/update_POST.schema";
import styles from "./EditQuestionDialog.module.css";

type EditQuestionDialogProps = {
  question: AIQuestionListItem;
};

export const EditQuestionDialog: React.FC<EditQuestionDialogProps> = ({ question }) => {
  const [isOpen, setIsOpen] = useState(false);
  const updateMutation = useUpdateAIQuestion();

  const form = useForm({
    schema: updateSchema,
    defaultValues: {
      id: question.id,
      questionText: question.questionText,
      optionA: question.optionA ?? undefined,
      optionB: question.optionB ?? undefined,
      optionC: question.optionC ?? undefined,
      optionD: question.optionD ?? undefined,
      optionE: question.optionE ?? undefined,
      correctOption: question.correctOption as "A" | "B" | "C" | "D" | "E",
      explanation: question.explanation ?? undefined,
      markedForReview: question.markedForReview,
    }
  });

  const onSubmit = (values: z.infer<typeof updateSchema>) => {
    updateMutation.mutate(values, {
      onSuccess: () => setIsOpen(false),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Edit question"><Edit size={16} /></Button>
      </DialogTrigger>
      <ConsoleDialogContent size="lg" aria-describedby={undefined}>
        <ConsoleDialogHeader title="Edit AI question" />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ConsoleDialogBody>
              <FormItem name="questionText">
                <FormLabel>Question</FormLabel>
                <p className={styles.helperText}>
                  Click on any formula to edit it. Use the 𝑓(x) button in the toolbar to insert new formulas.
                </p>
                <FormControl>
                  <RichTextEditor
                    value={form.values.questionText}
                    onChange={val => form.setValues(v => ({ ...v, questionText: val }))}
                    placeholder="Enter question text..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="optionA">
                <FormLabel>Option A</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={form.values.optionA}
                    onChange={val => form.setValues(v => ({ ...v, optionA: val }))}
                    placeholder="Option A"
                    className={styles.compactEditor}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="optionB">
                <FormLabel>Option B</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={form.values.optionB}
                    onChange={val => form.setValues(v => ({ ...v, optionB: val }))}
                    placeholder="Option B"
                    className={styles.compactEditor}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="optionC">
                <FormLabel>Option C</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={form.values.optionC}
                    onChange={val => form.setValues(v => ({ ...v, optionC: val }))}
                    placeholder="Option C"
                    className={styles.compactEditor}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="optionD">
                <FormLabel>Option D</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={form.values.optionD}
                    onChange={val => form.setValues(v => ({ ...v, optionD: val }))}
                    placeholder="Option D"
                    className={styles.compactEditor}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="optionE">
                <FormLabel>Option E (optional)</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={form.values.optionE || ''}
                    onChange={val => form.setValues(v => ({ ...v, optionE: val }))}
                    placeholder="Option E"
                    className={styles.compactEditor}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="correctOption">
                <FormLabel>Correct answer</FormLabel>
                <div className={styles.radioGroup} role="radiogroup" aria-label="Correct answer">
                  {['A', 'B', 'C', 'D', 'E'].map(opt => (
                    <label key={opt} className={styles.radioLabel}>
                      <input type="radio" name="correctOption" value={opt} checked={form.values.correctOption === opt} onChange={() => form.setValues(v => ({ ...v, correctOption: opt as "A" | "B" | "C" | "D" | "E" }))} />
                      {opt}
                    </label>
                  ))}
                </div>
                <FormMessage />
              </FormItem>

              <FormItem name="explanation">
                <FormLabel>Explanation</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={form.values.explanation || ''}
                    onChange={val => form.setValues(v => ({ ...v, explanation: val }))}
                    placeholder="Explanation..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="markedForReview" className={styles.checkboxFormItem}>
                <FormControl>
                  <Checkbox id="markedForReview" checked={form.values.markedForReview} onChange={(e) => form.setValues(v => ({ ...v, markedForReview: e.target.checked }))} />
                </FormControl>
                <FormLabel htmlFor="markedForReview">Mark for review</FormLabel>
              </FormItem>
            </ConsoleDialogBody>

            <ConsoleDialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </ConsoleDialogFooter>
          </form>
        </Form>
      </ConsoleDialogContent>
    </Dialog>
  );
};