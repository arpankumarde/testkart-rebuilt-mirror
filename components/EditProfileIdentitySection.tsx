import React from 'react';
import { FormItem, FormLabel, FormControl, FormDescription, FormMessage } from './Form';
import { Input } from './Input';
import { TeacherAvatarField } from './TeacherAvatarField';
import { VerifiedBadge } from './VerifiedBadge';
import { TeacherProfileFormValues } from '../helpers/teacherProfileFormSchema';
import { useUploadLimits } from '../helpers/useUploadLimits';
import styles from './EditProfileIdentitySection.module.css';

export const TAGLINE_MAX = 150;

interface EditProfileIdentitySectionProps {
  formValues: TeacherProfileFormValues;
  onValuesChange: (values: Partial<TeacherProfileFormValues>) => void;
  isOnboarding?: boolean;
  isVerified?: boolean;
}

// Photo, name, academy and tagline: the top of the public profile.
export const EditProfileIdentitySection: React.FC<EditProfileIdentitySectionProps> = ({
  formValues,
  onValuesChange,
  isOnboarding = false,
  isVerified = false,
}) => {
  const limits = useUploadLimits();
  const taglineLength = (formValues.tagline ?? '').length;

  return (
    <div className={styles.fields}>
      <TeacherAvatarField
        avatarUrl={formValues.avatarUrl}
        avatarFileId={formValues.avatarFileId}
        displayName={formValues.displayName}
        maxSizeInMB={limits.profilePictureMaxMb}
        onChange={(next) => onValuesChange(next)}
      />

      <div className={styles.row}>
        <FormItem name="displayName">
          <div className={styles.labelRow}>
            <FormLabel>Display name</FormLabel>
            {isOnboarding && <span className={styles.requiredTag}>Required</span>}
            {isVerified && (
              <span className={styles.verified}>
                <VerifiedBadge isVerified size="xs" />
                Verified
              </span>
            )}
          </div>
          <FormControl>
            <Input
              value={formValues.displayName}
              onChange={(e) => onValuesChange({ displayName: e.target.value })}
              placeholder="e.g. Ritu Sharma"
              autoComplete="name"
            />
          </FormControl>
          <FormDescription>The name on your profile, tests and courses.</FormDescription>
          <FormMessage />
        </FormItem>

        <FormItem name="academyName">
          <div className={styles.labelRow}>
            <FormLabel>Academy name</FormLabel>
            <span className={styles.optional}>Optional</span>
          </div>
          <FormControl>
            <Input
              value={formValues.academyName || ''}
              onChange={(e) => onValuesChange({ academyName: e.target.value })}
              placeholder="e.g. Sharma Classes"
              maxLength={100}
            />
          </FormControl>
          <FormDescription>Leave blank if you teach on your own.</FormDescription>
          <FormMessage />
        </FormItem>
      </div>

      <FormItem name="tagline">
        <div className={styles.labelRow}>
          <FormLabel>Tagline</FormLabel>
          <span
            className={`${styles.counter} ${taglineLength >= TAGLINE_MAX ? styles.counterFull : ''}`}
            aria-hidden="true"
          >
            {taglineLength}/{TAGLINE_MAX}
          </span>
        </div>
        <FormControl>
          <Input
            value={formValues.tagline || ''}
            onChange={(e) => onValuesChange({ tagline: e.target.value })}
            placeholder="e.g. SSC Maths made simple - 12 years, 40,000+ students"
            maxLength={TAGLINE_MAX}
          />
        </FormControl>
        <FormDescription>One line under your name. Say who you help and how.</FormDescription>
        <FormMessage />
      </FormItem>
    </div>
  );
};
