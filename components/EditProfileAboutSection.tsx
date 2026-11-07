import React from 'react';
import { FormItem, FormLabel, FormControl, FormDescription, FormMessage } from './Form';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { LanguageMultiPicker } from './LanguageMultiPicker';
import { ProfileTagInput } from './ProfileTagInput';
import { TeacherProfileFormValues } from '../helpers/teacherProfileFormSchema';
import styles from './EditProfileIdentitySection.module.css';

export const BIO_GOOD_LENGTH = 150;

interface EditProfileAboutSectionProps {
  formValues: TeacherProfileFormValues;
  onValuesChange: (values: Partial<TeacherProfileFormValues>) => void;
  isOnboarding?: boolean;
}

// About text, subjects, languages and location.
export const EditProfileAboutSection: React.FC<EditProfileAboutSectionProps> = ({
  formValues,
  onValuesChange,
  isOnboarding = false,
}) => {
  const bioLength = (formValues.bio ?? '').trim().length;

  return (
    <div className={styles.fields}>
      <FormItem name="bio">
        <div className={styles.labelRow}>
          <FormLabel>About you</FormLabel>
          {isOnboarding && <span className={styles.requiredTag}>Required</span>}
          <span className={styles.counter} aria-hidden="true">
            {bioLength < BIO_GOOD_LENGTH ? `${bioLength}/${BIO_GOOD_LENGTH}` : `${bioLength} characters`}
          </span>
        </div>
        <FormControl>
          <Textarea
            placeholder="What you teach, how long you have taught, and what students get from your tests and classes."
            value={formValues.bio || ''}
            onChange={(e) => onValuesChange({ bio: e.target.value })}
            rows={6}
          />
        </FormControl>
        <FormDescription>
          {bioLength < BIO_GOOD_LENGTH
            ? `Aim for at least ${BIO_GOOD_LENGTH} characters. Students read this before they buy.`
            : 'Good length. Students read this before they buy.'}
        </FormDescription>
        <FormMessage />
      </FormItem>

      <FormItem name="expertiseAreas">
        <FormLabel>Subjects and exams</FormLabel>
        <FormControl>
          <ProfileTagInput
            label="Subjects and exams"
            value={formValues.expertiseAreas ?? []}
            onChange={(next) => onValuesChange({ expertiseAreas: next })}
            placeholder="e.g. Quantitative Aptitude, then press Enter"
          />
        </FormControl>
        <FormDescription>Press Enter or type a comma after each one. Up to 12.</FormDescription>
        <FormMessage />
      </FormItem>

      <div className={styles.row}>
        <FormItem name="languages">
          <FormLabel>Teaching languages</FormLabel>
          <LanguageMultiPicker
            value={formValues.languages ?? []}
            onChange={(next) => onValuesChange({ languages: next })}
            placeholder="Add a language"
          />
          <FormMessage />
        </FormItem>

        <FormItem name="location">
          <FormLabel>Location</FormLabel>
          <FormControl>
            <Input
              placeholder="e.g. Patna, Bihar"
              value={formValues.location || ''}
              onChange={(e) => onValuesChange({ location: e.target.value })}
              autoComplete="address-level2"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      </div>
    </div>
  );
};
