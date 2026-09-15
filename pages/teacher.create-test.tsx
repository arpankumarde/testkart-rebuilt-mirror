import { Helmet } from "react-helmet";
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTeacherBulkMutations } from "../helpers/useTeacherBulkMutations";
import { useAuth } from "../helpers/useAuth";
import { AIContentPrompt } from "../components/AIContentPrompt";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Checkbox } from "../components/Checkbox";
import { AutoComplete, type Option } from "../components/AutoComplete";
import { ExamNamePicker } from "../components/ExamNamePicker";
import { ThumbnailUploader } from "../components/ThumbnailUploader";
import { AIRewriteButton } from "../components/AIRewriteButton";
import { AIListGenerateButton } from "../components/AIListGenerateButton";
import { RichTextEditor } from "../components/RichTextEditor";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../components/Collapsible";
import { X, Plus, ChevronDown, ArrowLeft } from "lucide-react";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useForm,
} from "../components/Form";
import { schema } from "../endpoints/teacher/tests/create-with-items_POST.schema";
import { z } from "zod";
import styles from "./teacher.create-test.module.css";

export default function CreateTestPage() {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;
  const teacherName = user?.displayName;

  const [showAIPrompt, setShowAIPrompt] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [aiData, setAiData] = useState<any>(null);
  const [languageInput, setLanguageInput] = useState("");
  const [isStorefrontOpen, setIsStorefrontOpen] = useState(false);

  const { useCreateTestWithItemsMutation } = useTeacherBulkMutations();
  const createTestMutation = useCreateTestWithItemsMutation();

  const form = useForm({
    defaultValues: {
      itemCount: 1,
      title: "",
      description: "",
      examName: "",
      language: "",
      price: 0,
      isFree: false,
      discountPrice: null,
      thumbnailUrl: "",
      thumbnailFileId: null,
      longDescription: "",
      whatYouLearn: [],
      requirements: [],
      subjects: [],
    },
    schema,
  });

  useEffect(() => {
    if (aiData && showForm) {
      form.setValues((prev) => ({
        ...prev,
        title: aiData.title || prev.title,
        description: aiData.shortDescription || (aiData.description ? aiData.description.slice(0, 200) : prev.description),
        examName: aiData.examName || prev.examName,
        language: aiData.language || prev.language,
        price: aiData.suggestedPrice || prev.price,
        longDescription: aiData.description || prev.longDescription,
      }));
      if (aiData.language) {
        setLanguageInput(aiData.language);
      }
    }
  }, [aiData, showForm, form.setValues]);

  const handleThumbnailChange = useCallback((url: string, fileId?: string) => {
    form.setValues((p) => ({ ...p, thumbnailUrl: url, thumbnailFileId: fileId || null }));
  }, [form.setValues]);

  const languageOptions: Option[] = [
    "Assamese", "Bengali", "Bodo", "Dogri", "English", "Gujarati", "Hindi",
    "Kannada", "Kashmiri", "Konkani", "Maithili", "Malayalam", "Manipuri",
    "Marathi", "Multilingual", "Nepali", "Odia", "Punjabi", "Sanskrit",
    "Santali", "Sindhi", "Tamil", "Telugu", "Urdu"
  ].map((lang) => ({
    value: lang,
    label: lang,
    displayText: lang
  }));

  const getAIContext = () => ({
    examName: form.values.examName || undefined,
    language: form.values.language || languageInput || undefined,
    price: form.values.price,
    title: form.values.title,
    description: form.values.description,
  });

  const onSubmit = (values: z.infer<typeof schema>) => {
    const filteredWhatYouLearn = values.whatYouLearn?.filter((v) => v.trim() !== '') || [];
    const filteredRequirements = values.requirements?.filter((v) => v.trim() !== '') || [];

    const finalValues = {
      ...values,
      language: languageInput || values.language,
      examName: values.examName || null,
      whatYouLearn: filteredWhatYouLearn.length > 0 ? filteredWhatYouLearn : null,
      requirements: filteredRequirements.length > 0 ? filteredRequirements : null,
      longDescription: values.longDescription || null
    };

    createTestMutation.mutate(finalValues, {
      onSuccess: (data) => {
        navigate(`/teacher/create-test/${data.id}/test-items`, {
          replace: true,
        });
      },
    });
  };

  if (showAIPrompt) {
    return (
      <>
        <Helmet>
          <title>Create a test series - Testkart for Teachers</title>
        </Helmet>
        <AIContentPrompt
          contentType="test"
          teacherName={teacherName}
          onGenerated={(data) => {
            setAiData(data);
            setShowAIPrompt(false);
            setShowForm(true);
          }}
          onSkip={() => {
            setShowAIPrompt(false);
            setShowForm(true);
          }}
        />
      </>
    );
  }

  if (!showForm) return null;

  const itemCount = Number(form.values.itemCount) || 0;

  return (
    <>
      <Helmet>
        <title>Create a test series - Testkart for Teachers</title>
        <meta
          name="description"
          content="Build and customize a new mock test series for your students on Testkart."
        />
      </Helmet>
      <div className={styles.container}>
        <Link to="/teacher/test-series" className={styles.backLink}>
          <ArrowLeft size={15} aria-hidden="true" />
          Test series
        </Link>

        <div className={styles.header}>
          <h1 className={styles.title}>Create a test series</h1>
          <p className={styles.subtitle}>
            Set up the series details here. You will add the individual tests and their questions in
            the next step.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Basics</h2>
                <span className={styles.sectionHint}>What students see when they browse.</span>
              </div>

              <FormItem name="title">
                <div className={styles.labelWithAI}>
                  <FormLabel>Title</FormLabel>
                  <AIRewriteButton
                    field="title"
                    contentType="test"
                    currentValue={form.values.title}
                    context={getAIContext()}
                    onAccept={(suggestion) => form.setValues(p => ({...p, title: suggestion}))}
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

              <div className={styles.row}>
                <FormItem name="examName">
                  <FormLabel>Exam</FormLabel>
                  <FormControl>
                    <ExamNamePicker
                      value={form.values.examName || ""}
                      onChange={(val) => form.setValues(p => ({...p, examName: val}))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="language">
                  <FormLabel>Language</FormLabel>
                  <FormControl>
                    <AutoComplete
                      options={languageOptions}
                      emptyMessage="No languages found"
                      placeholder="e.g., English, Hindi, Tamil"
                      inputValue={languageInput}
                      onInputValueChange={(value) => {
                        setLanguageInput(value);
                        form.setValues((p) => ({ ...p, language: value || "" }));
                      }}
                      onValueChange={(option) => {
                        setLanguageInput(option.value);
                        form.setValues((p) => ({ ...p, language: option.value || "" }));
                      }}
                      allowFreeForm={true}
                    />
                  </FormControl>
                  <FormDescription>Pick one from the list or type your own.</FormDescription>
                  <FormMessage />
                </FormItem>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Pricing</h2>
                <span className={styles.sectionHint}>You can change this at any time.</span>
              </div>

              <FormItem name="isFree">
                <div className={styles.freeToggle}>
                  <Checkbox
                    id="isFree"
                    checked={form.values.isFree}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      form.setValues((p) => ({
                        ...p,
                        isFree: isChecked,
                        price: isChecked ? 0 : p.price,
                        discountPrice: isChecked ? null : p.discountPrice
                      }));
                    }}
                  />
                  <span className={styles.freeToggleText}>
                    <label htmlFor="isFree" className={styles.freeToggleLabel}>
                      Give this series away free
                    </label>
                    <span className={styles.freeToggleHint}>
                      Sets the price and discount to zero. Good for building an audience.
                    </span>
                  </span>
                </div>
                <FormMessage />
              </FormItem>

              {!form.values.isFree && (
                <div className={styles.row}>
                  <FormItem name="price">
                    <FormLabel>Price (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 299"
                        value={form.values.price}
                        onChange={(e) =>
                          form.setValues((p) => ({ ...p, price: Number(e.target.value) }))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>

                  <FormItem name="discountPrice">
                    <FormLabel>Discounted price (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Optional"
                        value={form.values.discountPrice ?? ""}
                        onChange={(e) =>
                          form.setValues((p) => ({
                            ...p,
                            discountPrice: e.target.value ? Number(e.target.value) : null
                          }))
                        }
                      />
                    </FormControl>
                    <FormDescription>Must be lower than the price.</FormDescription>
                    <FormMessage />
                  </FormItem>
                </div>
              )}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Structure</h2>
                <span className={styles.sectionHint}>How many tests this series starts with.</span>
              </div>

              <FormItem name="itemCount">
                <FormLabel>Number of tests</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={50}
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
                <FormDescription>
                  We will create {itemCount > 0 ? itemCount : "these"}{" "}
                  {itemCount === 1 ? "empty test" : "empty tests"} for you to fill in next. You can
                  add more later.
                </FormDescription>
                <FormMessage />
              </FormItem>
            </section>

            <Collapsible open={isStorefrontOpen} onOpenChange={setIsStorefrontOpen} className={styles.storefront}>
              <CollapsibleTrigger className={styles.storefrontTrigger}>
                <span>
                  Storefront details
                  <span className={styles.storefrontHint}>
                    Short bio, thumbnail and highlights. Optional, and editable any time.
                  </span>
                </span>
                <ChevronDown size={18} className={styles.storefrontChevron} />
              </CollapsibleTrigger>
              <CollapsibleContent className={styles.storefrontContent}>

              <FormItem name="description">
                <div className={styles.labelWithAI}>
                  <FormLabel>Short bio</FormLabel>
                  <AIRewriteButton
                    field="shortDescription"
                    contentType="test"
                    currentValue={form.values.description}
                    context={getAIContext()}
                    onAccept={(suggestion) => form.setValues(p => ({...p, description: suggestion}))}
                  />
                </div>
                <FormControl>
                  <Textarea
                    placeholder="A line or two about what this series covers"
                    rows={3}
                    maxLength={200}
                    value={form.values.description}
                    onChange={(e) => form.setValues((p) => ({ ...p, description: e.target.value }))}
                  />
                </FormControl>
                <FormDescription>
                  {form.values.description?.length || 0}/200 characters
                </FormDescription>
                <FormMessage />
              </FormItem>

              <FormItem name="whatYouLearn">
                <div className={styles.labelWithAI}>
                  <FormLabel>What students will master</FormLabel>
                  <AIListGenerateButton
                    field="whatYouLearn"
                    context={{
                      title: form.values.title,
                      examName: form.values.examName ?? undefined,
                      shortDescription: form.values.description,
                      longDescription: form.values.longDescription ?? undefined,
                      existingItems: form.values.whatYouLearn?.filter((v) => v.trim() !== ""),
                    }}
                    onGenerate={(items) => {
                      form.setValues((p) => {
                        const existing = (p.whatYouLearn || []).filter((v) => v.trim() !== "");
                        return { ...p, whatYouLearn: [...existing, ...items] };
                      });
                    }}
                  />
                </div>
                <div className={styles.dynamicList}>
                  {form.values.whatYouLearn?.map((item, index) =>
                    <div key={index} className={styles.dynamicListRow}>
                      <FormControl>
                        <Input
                          placeholder="e.g., Master every topic in the syllabus"
                          value={item}
                          onChange={(e) => {
                            form.setValues((p) => {
                              const newList = [...(p.whatYouLearn || [])];
                              newList[index] = e.target.value;
                              return { ...p, whatYouLearn: newList };
                            });
                          }}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-md"
                        onClick={() => {
                          form.setValues((p) => {
                            const newList = [...(p.whatYouLearn || [])];
                            newList.splice(index, 1);
                            return { ...p, whatYouLearn: newList };
                          });
                        }}
                        aria-label="Remove item"
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={styles.dynamicListAdd}
                    onClick={() => {
                      form.setValues((p) => ({
                        ...p,
                        whatYouLearn: [...(p.whatYouLearn || []), ""]
                      }));
                    }}
                  >
                    <Plus size={16} /> Add item
                  </Button>
                </div>
                <FormDescription>
                  Leave empty to hide this section on the public page.
                </FormDescription>
                <FormMessage />
              </FormItem>

              <FormItem name="requirements">
                <div className={styles.labelWithAI}>
                  <FormLabel>Requirements</FormLabel>
                  <AIListGenerateButton
                    field="requirements"
                    context={{
                      title: form.values.title,
                      examName: form.values.examName ?? undefined,
                      shortDescription: form.values.description,
                      longDescription: form.values.longDescription ?? undefined,
                      existingItems: form.values.requirements?.filter((v) => v.trim() !== ""),
                    }}
                    onGenerate={(items) => {
                      form.setValues((p) => {
                        const existing = (p.requirements || []).filter((v) => v.trim() !== "");
                        return { ...p, requirements: [...existing, ...items] };
                      });
                    }}
                  />
                </div>
                <div className={styles.dynamicList}>
                  {form.values.requirements?.map((item, index) =>
                    <div key={index} className={styles.dynamicListRow}>
                      <FormControl>
                        <Input
                          placeholder="e.g., Basic understanding of the exam syllabus"
                          value={item}
                          onChange={(e) => {
                            form.setValues((p) => {
                              const newList = [...(p.requirements || [])];
                              newList[index] = e.target.value;
                              return { ...p, requirements: newList };
                            });
                          }}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-md"
                        onClick={() => {
                          form.setValues((p) => {
                            const newList = [...(p.requirements || [])];
                            newList.splice(index, 1);
                            return { ...p, requirements: newList };
                          });
                        }}
                        aria-label="Remove item"
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={styles.dynamicListAdd}
                    onClick={() => {
                      form.setValues((p) => ({
                        ...p,
                        requirements: [...(p.requirements || []), ""]
                      }));
                    }}
                  >
                    <Plus size={16} /> Add item
                  </Button>
                </div>
                <FormDescription>
                  Leave empty to hide this section on the public page.
                </FormDescription>
                <FormMessage />
              </FormItem>

              <FormItem name="longDescription">
                <div className={styles.labelWithAI}>
                  <FormLabel>Full description</FormLabel>
                  <AIRewriteButton
                    field="description"
                    contentType="test"
                    currentValue={form.values.longDescription || ""}
                    context={getAIContext()}
                    onAccept={(suggestion) => form.setValues(p => ({...p, longDescription: suggestion}))}
                  />
                </div>
                <FormControl>
                  <RichTextEditor
                    placeholder="Describe the series in full"
                    value={form.values.longDescription || ""}
                    onChange={(html) => form.setValues((p) => ({ ...p, longDescription: html }))}
                    disableMediaUpload
                  />
                </FormControl>
                <FormDescription>
                  Leave empty to hide this section on the public page.
                </FormDescription>
                <FormMessage />
              </FormItem>

              <FormItem name="thumbnailUrl">
                <FormLabel>Thumbnail</FormLabel>
                <FormControl>
                  <ThumbnailUploader
                    value={form.values.thumbnailUrl || undefined}
                    currentFileId={form.values.thumbnailFileId ?? undefined}
                    onChange={handleThumbnailChange}
                    folder="test-thumbnails"
                  />
                </FormControl>
                <FormDescription>
                  Shown on the series card. A clear 16:9 image works best.
                </FormDescription>
                <FormMessage />
              </FormItem>

              </CollapsibleContent>
            </Collapsible>

            {createTestMutation.isError && (
              <div className={styles.error} role="alert">
                The series could not be created. Check the fields above and try again.
              </div>
            )}

            <div className={styles.actions}>
              <p className={styles.actionsNote}>Nothing goes live until you publish it.</p>
              <Button type="submit" disabled={createTestMutation.isPending}>
                {createTestMutation.isPending ? "Creating..." : "Create and add tests"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </>
  );
}
