import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Button } from "./Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { ThumbnailUploader } from "./ThumbnailUploader";
import { VideoUploader } from "./VideoUploader";
import { useTeacherTestMutations } from "../helpers/useTeacherTestMutations";
import { useTeacherTestsQuery } from "../helpers/useTeacherTestsQuery";
import { toast } from "sonner";
import { schema as createTestSchema } from "../endpoints/teacher/tests/create_POST.schema";
import { useEffect } from "react";
import { X, Plus } from "lucide-react";
import { Checkbox } from "./Checkbox";
import { AIRewriteButton } from "./AIRewriteButton";
import styles from "./TestBasicInfoForm.module.css";

type TestBasicInfoFormProps = {
  onSave: (testPackageId: number) => void;
  testPackageId?: number | null;
};

export const TestBasicInfoForm = ({ onSave, testPackageId }: TestBasicInfoFormProps) => {
  const { useCreateTestMutation, useUpdateTestMutation } = useTeacherTestMutations();
  const createTest = useCreateTestMutation();
  const updateTest = useUpdateTestMutation();
  const { data: tests } = useTeacherTestsQuery();

  // Find existing test data if editing
  const existingTest = tests?.find((t) => t.id === testPackageId);
  const isEditMode = !!testPackageId;

  const form = useForm({
    schema: createTestSchema,
    defaultValues: {
      title: "",
      description: "",
      subjects: [],
      language: "",
      price: 0,
      isFree: false,
      discountPrice: null,
      thumbnailUrl: "",
      thumbnailFileId: null,
      introVideoUrl: null,
      introVideoFileId: null,
    },
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (existingTest) {
      // Parse subjects from JSON string in database
      let parsedSubjects: string[] = [];
      if (existingTest.subject) {
        try {
          parsedSubjects = JSON.parse(existingTest.subject);
          if (!Array.isArray(parsedSubjects)) {
            parsedSubjects = [existingTest.subject];
          }
        } catch (error) {
          console.error("Failed to parse subjects:", error);
          parsedSubjects = [existingTest.subject];
        }
      }

      form.setValues({
        title: existingTest.title,
        description: existingTest.description || "",
        subjects: parsedSubjects,
        language: existingTest.language || "",
        price: existingTest.price,
        isFree: existingTest.isFree,
        discountPrice: existingTest.discountPrice ? Number(existingTest.discountPrice) : null,
        thumbnailUrl: existingTest.thumbnailUrl || "",
        thumbnailFileId: existingTest.thumbnailFileId || null,
        introVideoUrl: existingTest.introVideoUrl || null,
        introVideoFileId: existingTest.introVideoFileId || null,
      });
    }
  }, [existingTest]);

  const onSubmit = (values: z.infer<typeof createTestSchema>) => {
    if (isEditMode && testPackageId) {
      // Update existing test
      updateTest.mutate(
        { testId: testPackageId, ...values },
        {
          onSuccess: (data) => {
            toast.success("Test information updated successfully.");
            onSave(data.id);
          },
          onError: (error) => {
            toast.error(
              error instanceof Error
                ? error.message
                : "Failed to update test info."
            );
          },
        }
      );
    } else {
      // Create new test
      createTest.mutate(values, {
        onSuccess: (data) => {
          toast.success("Basic info saved as a draft.");
          onSave(data.id);
        },
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to save test info."
          );
        },
      });
    }
  };

  const addSubject = () => {
    form.setValues((prev: typeof form.values) => ({
      ...prev,
      subjects: [...prev.subjects, ""],
    }));
  };

  const removeSubject = (index: number) => {
    form.setValues((prev: typeof form.values) => {
      const updatedSubjects = [...prev.subjects];
      updatedSubjects.splice(index, 1);
      return {
        ...prev,
        subjects: updatedSubjects,
      };
    });
  };

  const updateSubject = (index: number, value: string) => {
    form.setValues((prev: typeof form.values) => {
      const updatedSubjects = [...prev.subjects];
      updatedSubjects[index] = value;
      return {
        ...prev,
        subjects: updatedSubjects,
      };
    });
  };

  const handleThumbnailChange = (url: string, fileId?: string) => {
    form.setValues((prev: typeof form.values) => ({
      ...prev,
      thumbnailUrl: url,
      thumbnailFileId: fileId || null,
    }));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
        <FormItem name="title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FormLabel>Test Title</FormLabel>
            <AIRewriteButton
              field="title"
              contentType="test"
              currentValue={form.values.title}
              context={{ subjects: form.values.subjects.filter(Boolean), language: form.values.language || undefined }}
              onAccept={(suggestion) => form.setValues((prev: typeof form.values) => ({ ...prev, title: suggestion }))}
            />
          </div>
          <FormControl>
            <Input
              placeholder="e.g., SSC CGL Tier 1 Full Mock Test Series"
              value={form.values.title}
              onChange={(e) =>
                form.setValues((prev: typeof form.values) => ({ ...prev, title: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="description">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FormLabel>Description</FormLabel>
            <AIRewriteButton
              field="description"
              contentType="test"
              currentValue={form.values.description}
              context={{ subjects: form.values.subjects.filter(Boolean), language: form.values.language || undefined, title: form.values.title }}
              onAccept={(suggestion) => form.setValues((prev: typeof form.values) => ({ ...prev, description: suggestion }))}
            />
          </div>
          <FormControl>
            <Textarea
              placeholder="Provide a detailed description of what this test package includes."
              rows={5}
              value={form.values.description}
              onChange={(e) =>
                form.setValues((prev: typeof form.values) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <div className={styles.grid}>
          <FormItem name="language">
            <FormLabel>Language</FormLabel>
            <FormControl>
              <Select
                value={form.values.language || '__empty'}
                onValueChange={(val) => form.setValues((prev: typeof form.values) => ({ 
                  ...prev, 
                  language: val === '__empty' ? "" : val
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                                <SelectContent>
                  <SelectItem value="__empty">Select language</SelectItem>
                  {["English", "Hindi", "Bengali", "Telugu", "Marathi", "Tamil",
                    "Gujarati", "Kannada", "Malayalam", "Odia", "Punjabi",
                    "Assamese", "Urdu", "Sanskrit", "Konkani", "Dogri",
                    "Bodo", "Maithili", "Santali", "Kashmiri", "Nepali",
                    "Sindhi", "Manipuri", "Multiple Languages"].map(lang => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            <FormDescription>
              Language in which the test will be conducted.
            </FormDescription>
            <FormMessage />
          </FormItem>

          <FormItem name="price">
            <FormLabel>Price (₹)</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="e.g., 299"
                value={form.values.price || ''}
                disabled={form.values.isFree}
                onChange={(e) =>
                  form.setValues((prev: typeof form.values) => ({
                    ...prev,
                    price: e.target.value === '' ? 0 : Number(e.target.value),
                  }))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="discountPrice">
            <FormLabel>Discount Price (₹) (Optional)</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="e.g., 199"
                value={form.values.discountPrice ?? ""}
                disabled={form.values.isFree}
                onChange={(e) =>
                  form.setValues((prev: typeof form.values) => ({
                    ...prev,
                    discountPrice: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
              />
            </FormControl>
            <FormDescription>
              Discount price must be less than the regular price.
            </FormDescription>
            <FormMessage />
          </FormItem>
        </div>

        <FormItem name="isFree">
          <div className={styles.checkboxWrapper}>
            <Checkbox
              id="isFree"
              checked={form.values.isFree}
              onChange={(e) => {
                const isChecked = e.target.checked;
                form.setValues((prev: typeof form.values) => ({
                  ...prev,
                  isFree: isChecked,
                  price: isChecked ? 0 : prev.price,
                  discountPrice: isChecked ? null : prev.discountPrice,
                }));
              }}
            />
            <label htmlFor="isFree" className={styles.checkboxLabel}>
              Mark as Free
            </label>
          </div>
          <FormDescription>
            When checked, price and discount will be set to 0.
          </FormDescription>
          <FormMessage />
        </FormItem>

        <FormItem name="subjects">
          <FormLabel>Subjects</FormLabel>
          {form.values.subjects.map((subject, index) => (
            <FormItem key={index} name={`subjects.${index}`}>
              <div className={styles.subjectRow}>
                <FormControl>
                  <Input
                    value={subject}
                    onChange={(e) => updateSubject(index, e.target.value)}
                    onBlur={() => form.validateField(`subjects.${index}`)}
                    placeholder="e.g., Quantitative Aptitude"
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-md"
                  onClick={() => removeSubject(index)}
                  aria-label="Remove subject"
                >
                  <X size={16} />
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addSubject}
            className={styles.addButton}
          >
            <Plus size={16} /> Add Subject
          </Button>
          <FormDescription>
            Add one or more subjects covered in this test package.
          </FormDescription>
          <FormMessage />
        </FormItem>

        <FormItem name="thumbnailUrl">
          <FormLabel>Thumbnail Image</FormLabel>
          <FormControl>
            <ThumbnailUploader
              value={form.values.thumbnailUrl ?? undefined}
              currentFileId={form.values.thumbnailFileId ?? undefined}
              onChange={handleThumbnailChange}
              folder="test-thumbnails"
            />
          </FormControl>
          <FormDescription>
            Upload a thumbnail image for your test package (16:9 aspect ratio recommended).
          </FormDescription>
          <FormMessage />
        </FormItem>

        <FormItem name="introVideoUrl">
          <FormLabel>Intro Video (Optional)</FormLabel>
          <FormControl>
            <VideoUploader
              folder="test-videos"
              onSuccess={({url, videoFileId}) => form.setValues(prev => ({...prev, introVideoUrl: url || null, introVideoFileId: videoFileId}))}
              currentVideoUrl={form.values.introVideoUrl ?? undefined}
              currentVideoFileId={form.values.introVideoFileId ?? undefined}
              maxSizeInMB={500}
              label="Upload Intro Video"
              allowYouTube={true}
            />
          </FormControl>
          <FormDescription>
            Upload an intro video or paste a YouTube URL for your test package.
          </FormDescription>
          <FormMessage />
        </FormItem>

        <div className={styles.footer}>
          <Button type="submit" disabled={createTest.isPending || updateTest.isPending}>
            {(createTest.isPending || updateTest.isPending)
              ? "Saving..."
              : isEditMode
              ? "Update and Continue"
              : "Save and Continue"}
          </Button>
        </div>
      </form>
    </Form>
  );
};