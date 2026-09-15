import React, { useState } from 'react';
import { LiveTestFormValues } from '../helpers/liveTestCreationFormSchema';
import { ExamNamePicker } from './ExamNamePicker';
import { FormItem, FormLabel, FormControl, FormDescription, FormMessage } from './Form';
import { Input } from './Input';
import { RichTextEditor } from './RichTextEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './Select';
import { Checkbox } from './Checkbox';
import { ThumbnailUploader } from './ThumbnailUploader';
import { VideoUploader } from './VideoUploader';
import { AIRewriteButton } from './AIRewriteButton';
import { AIListGenerateButton } from './AIListGenerateButton';
import { Button } from './Button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './Collapsible';
import { ChevronDown, Plus, X, FileText, SlidersHorizontal, Wallet } from 'lucide-react';
import styles from './LiveTestBasicInfoStep.module.css';

interface LiveTestBasicInfoStepProps {
  values: LiveTestFormValues;
  setValues: React.Dispatch<React.SetStateAction<LiveTestFormValues>>;
  // Locks the fields that define the committed test (exam, format/timing,
  // pricing, capacity) once published - see helpers/liveTestLocks.tsx, which the
  // update endpoint enforces. Title, description, language, media and storefront
  // copy stay editable anytime.
  disabled?: boolean;
  // Lets the parent open the Storefront section, e.g. to show a validation error
  // inside it. Uncontrolled when omitted.
  storefrontOpen?: boolean;
  onStorefrontOpenChange?: (open: boolean) => void;
}

export const LiveTestBasicInfoStep: React.FC<LiveTestBasicInfoStepProps> = ({
  values,
  setValues,
  disabled = false,
  storefrontOpen,
  onStorefrontOpenChange,
}) => {
  const [localStorefrontOpen, setLocalStorefrontOpen] = useState(false);
  const isStorefrontOpen = storefrontOpen ?? localStorefrontOpen;
  const setIsStorefrontOpen = onStorefrontOpenChange ?? setLocalStorefrontOpen;
  const languageOptions = [
    "English", "Hindi", "Bengali", "Telugu", "Marathi", "Tamil",
    "Gujarati", "Kannada", "Malayalam", "Odia", "Punjabi",
    "Assamese", "Urdu", "Sanskrit", "Konkani", "Dogri",
    "Bodo", "Maithili", "Santali", "Kashmiri", "Nepali",
    "Sindhi", "Manipuri", "Multiple Languages",
  ];

  return (
    <div className={styles.stepContainer}>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <FileText size={16} className={styles.sectionIcon} />
          <h3 className={styles.sectionTitle}>Test Details</h3>
        </div>
        <div className={styles.sectionBody}>
          <FormItem name="title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FormLabel>Test Title</FormLabel>
              <AIRewriteButton
                field="title"
                contentType="liveTest"
                currentValue={values.title}
                context={{ examName: values.examName || undefined, language: values.language || undefined, duration: values.durationMinutes, price: values.price }}
                onAccept={(suggestion) => setValues(p => ({...p, title: suggestion}))}
              />
            </div>
            <FormControl>
              <Input 
                value={values.title} 
                onChange={e => setValues(p => ({...p, title: e.target.value}))} 
                placeholder="e.g., SSC CGL Live Mock Test 2024"
              />
            </FormControl>
            <FormDescription>Give your live test a descriptive title.</FormDescription>
            <FormMessage />
          </FormItem>

          <FormItem name="description">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FormLabel>Description</FormLabel>
              <AIRewriteButton
                field="description"
                contentType="liveTest"
                currentValue={values.description ?? ''}
                context={{ examName: values.examName || undefined, language: values.language || undefined, duration: values.durationMinutes, price: values.price, title: values.title }}
                onAccept={(suggestion) => setValues(p => ({...p, description: suggestion}))}
              />
            </div>
            <FormControl>
              <RichTextEditor
                value={values.description ?? ''}
                onChange={(html) => setValues(p => ({...p, description: html}))}
                placeholder="Describe what students will learn and test features..."
                disableMediaUpload
              />
            </FormControl>
            <FormDescription>Provide details about the test content and format.</FormDescription>
            <FormMessage />
          </FormItem>

          <div className={styles.grid}>
            <FormItem name="examName">
              <FormLabel>Exam Name</FormLabel>
              <FormControl>
                <ExamNamePicker 
                  value={values.examName || ""} 
                  onChange={(val) => setValues(p => ({...p, examName: val}))} 
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="language">
              <FormLabel>Language</FormLabel>
              <FormControl>
                <Select
                  value={values.language || '__empty'}
                  onValueChange={(val) => setValues(prev => ({ 
                    ...prev, 
                    language: val === '__empty' ? undefined : (val as NonNullable<LiveTestFormValues["language"]>)
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty">Select language</SelectItem>
                    {languageOptions.map((lang) => (
                      <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormDescription>Language in which the test will be conducted.</FormDescription>
              <FormMessage />
            </FormItem>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <SlidersHorizontal size={16} className={styles.sectionIcon} />
          <h3 className={styles.sectionTitle}>Format & Timing</h3>
        </div>
        <div className={styles.sectionBody}>
          {!(values.subjectWiseTiming || values.questionWiseTiming) && (
            <FormItem name="durationMinutes">
              <FormLabel>Duration (Minutes)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  value={values.durationMinutes || ''} 
                  disabled={disabled}
                  onChange={e => setValues(p => ({...p, durationMinutes: e.target.value === '' ? 0 : Number(e.target.value)}))} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}

          <FormItem name="calculatorEnabled">
            <div className={styles.checkboxContainer}>
              <FormControl>
                <Checkbox
                  id="calculatorEnabled-live"
                  checked={values.calculatorEnabled}
                  disabled={disabled}
                  onChange={(e) => setValues(p => ({ ...p, calculatorEnabled: e.target.checked }))}
                />
              </FormControl>
              <FormLabel htmlFor="calculatorEnabled-live">Enable Scientific Calculator</FormLabel>
            </div>
            <FormDescription>Students will have access to a scientific calculator during this test.</FormDescription>
            <FormMessage />
          </FormItem>

          <FormItem name="subjectWiseTiming">
            <div className={styles.checkboxContainer}>
              <FormControl>
                <Checkbox
                  id="subjectWiseTiming-live"
                  checked={values.subjectWiseTiming}
                  disabled={disabled}
                  onChange={(e) =>
                    setValues((p) => ({
                      ...p,
                      subjectWiseTiming: e.target.checked,
                      ...(e.target.checked ? { questionWiseTiming: false } : {}),
                    }))
                  }
                />
              </FormControl>
              <FormLabel htmlFor="subjectWiseTiming-live">Enable Subject-wise Timing</FormLabel>
            </div>
            <FormDescription>Each subject will have its own timer instead of a single overall timer.</FormDescription>
            <FormMessage />
          </FormItem>

          <FormItem name="questionWiseTiming">
            <div className={styles.checkboxContainer}>
              <FormControl>
                <Checkbox
                  id="questionWiseTiming-live"
                  checked={values.questionWiseTiming}
                  disabled={disabled}
                  onChange={(e) =>
                    setValues((p) => ({
                      ...p,
                      questionWiseTiming: e.target.checked,
                      ...(e.target.checked ? { subjectWiseTiming: false } : {}),
                    }))
                  }
                />
              </FormControl>
              <FormLabel htmlFor="questionWiseTiming-live">Enable Question-wise Timing</FormLabel>
            </div>
            <FormDescription>Each question will have its own timer instead of a single overall timer.</FormDescription>
            <FormMessage />
          </FormItem>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Wallet size={16} className={styles.sectionIcon} />
          <h3 className={styles.sectionTitle}>Pricing & Capacity</h3>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.grid}>
            <FormItem name="price">
              <FormLabel>Price (₹)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  value={values.price || ''} 
                  disabled={disabled || values.isFree}
                  onChange={e => setValues(p => ({...p, price: e.target.value === '' ? 0 : Number(e.target.value)}))} 
                />
              </FormControl>
              <FormDescription>Entry fee for students to participate.</FormDescription>
              <FormMessage />
            </FormItem>

            <FormItem name="discountPrice">
              <FormLabel>Discount Price (₹) (Optional)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  value={values.discountPrice ?? ''}
                  disabled={disabled || values.isFree}
                  onChange={e => setValues(p => ({
                    ...p,
                    discountPrice: e.target.value === '' ? null : Number(e.target.value),
                  }))}
                />
              </FormControl>
              <FormDescription>Discount price must be less than the regular price.</FormDescription>
              <FormMessage />
            </FormItem>

            <FormItem name="maxSeats">
              <FormLabel>Max Seats</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  value={values.maxSeats || ''} 
                  disabled={disabled}
                  onChange={e => setValues(p => ({...p, maxSeats: e.target.value === '' ? 0 : Number(e.target.value)}))} 
                />
              </FormControl>
              <FormDescription>Maximum number of participants.</FormDescription>
              <FormMessage />
            </FormItem>
          </div>

          <FormItem name="isFree">
            <div className={styles.checkboxContainer}>
              <FormControl>
                <Checkbox
                  id="isFree-live"
                  checked={values.isFree || false}
                  disabled={disabled}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setValues(p => ({
                      ...p,
                      isFree: isChecked,
                      price: isChecked ? 0 : p.price,
                      discountPrice: isChecked ? null : p.discountPrice,
                    }));
                  }}
                />
              </FormControl>
              <FormLabel htmlFor="isFree-live">Mark as Free</FormLabel>
            </div>
            <FormDescription>When checked, price and discount will be set to 0.</FormDescription>
            <FormMessage />
          </FormItem>
        </div>
      </div>

      <Collapsible open={isStorefrontOpen} onOpenChange={setIsStorefrontOpen} className={styles.storefrontSection}>
        <CollapsibleTrigger className={styles.storefrontTrigger}>
          <span>
            Storefront details{" "}
            <span className={styles.storefrontHint}>
              (thumbnail, intro video, what you'll master, requirements - optional, edit anytime)
            </span>
          </span>
          <ChevronDown size={18} className={styles.storefrontChevron} />
        </CollapsibleTrigger>
        <CollapsibleContent className={styles.storefrontContent}>
          <FormItem name="thumbnailUrl">
            <FormLabel>Thumbnail (Optional)</FormLabel>
            <FormControl>
              <ThumbnailUploader
                value={values.thumbnailUrl ?? ''}
                currentFileId={values.thumbnailFileId ?? undefined}
                onChange={(url, fileId) => setValues(p => ({
                  ...p,
                  thumbnailUrl: url || null,
                  thumbnailFileId: url ? fileId ?? null : null,
                }))}
                folder="thumbnails/live-tests"
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="introVideoUrl">
            <FormLabel>Intro Video (Optional)</FormLabel>
            <FormControl>
              <VideoUploader
                folder="live-test-videos"
                onSuccess={({url, videoFileId}) => setValues(p => ({...p, introVideoUrl: url || null, introVideoFileId: url ? videoFileId ?? null : null}))}
                currentVideoUrl={values.introVideoUrl ?? undefined}
                currentVideoFileId={values.introVideoFileId ?? undefined}
                maxSizeInMB={500}
                label="Upload Intro Video"
                allowYouTube={true}
              />
            </FormControl>
            <FormDescription>Upload an intro video or paste a YouTube URL.</FormDescription>
            <FormMessage />
          </FormItem>

          <FormItem name="whatYouLearn">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FormLabel>What You'll Master (Optional)</FormLabel>
              <AIListGenerateButton
                field="whatYouLearn"
                context={{
                  title: values.title,
                  examName: values.examName ?? undefined,
                  shortDescription: values.description ?? undefined,
                  existingItems: (values.whatYouLearn || []).filter((v) => v.trim() !== ""),
                }}
                onGenerate={(items) => {
                  setValues((p) => {
                    const existing = (p.whatYouLearn || []).filter((v) => v.trim() !== "");
                    return { ...p, whatYouLearn: [...existing, ...items] };
                  });
                }}
              />
            </div>
            <div className={styles.dynamicList}>
              {values.whatYouLearn?.map((item, index) => (
                <div key={index} className={styles.dynamicListRow}>
                  <FormControl>
                    <Input
                      placeholder="e.g., Master all topics covered in the syllabus"
                      value={item}
                      onChange={(e) => {
                        setValues((p) => {
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
                      setValues((p) => {
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
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={styles.dynamicListAdd}
                onClick={() => {
                  setValues((p) => ({
                    ...p,
                    whatYouLearn: [...(p.whatYouLearn || []), ""],
                  }));
                }}
              >
                <Plus size={16} /> Add item
              </Button>
            </div>
            <FormDescription>
              Add bullet points describing what students will learn. Leave empty to hide this section.
            </FormDescription>
            <FormMessage />
          </FormItem>

          <FormItem name="requirements">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FormLabel>Requirements (Optional)</FormLabel>
              <AIListGenerateButton
                field="requirements"
                context={{
                  title: values.title,
                  examName: values.examName ?? undefined,
                  shortDescription: values.description ?? undefined,
                  existingItems: (values.requirements || []).filter((v) => v.trim() !== ""),
                }}
                onGenerate={(items) => {
                  setValues((p) => {
                    const existing = (p.requirements || []).filter((v) => v.trim() !== "");
                    return { ...p, requirements: [...existing, ...items] };
                  });
                }}
              />
            </div>
            <div className={styles.dynamicList}>
              {values.requirements?.map((item, index) => (
                <div key={index} className={styles.dynamicListRow}>
                  <FormControl>
                    <Input
                      placeholder="e.g., Basic understanding of the exam syllabus"
                      value={item}
                      onChange={(e) => {
                        setValues((p) => {
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
                      setValues((p) => {
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
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={styles.dynamicListAdd}
                onClick={() => {
                  setValues((p) => ({
                    ...p,
                    requirements: [...(p.requirements || []), ""],
                  }));
                }}
              >
                <Plus size={16} /> Add item
              </Button>
            </div>
            <FormDescription>
              Add requirements or prerequisites for this test. Leave empty to hide this section.
            </FormDescription>
            <FormMessage />
          </FormItem>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
