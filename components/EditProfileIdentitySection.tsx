import React from 'react';
import { FormItem, FormLabel, FormControl, FormDescription, FormMessage } from './Form';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { TeacherAvatarField } from './TeacherAvatarField';
import { VerifiedBadge } from './VerifiedBadge';
import { TeacherProfileFormValues } from '../helpers/teacherProfileFormSchema';
import { ExternalLink, Copy, BadgeCheck } from 'lucide-react';
import { Button } from './Button';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useUploadLimits } from '../helpers/useUploadLimits';
import styles from './EditProfileIdentitySection.module.css';

interface EditProfileIdentitySectionProps {
  formValues: TeacherProfileFormValues;
  onValuesChange: (values: Partial<TeacherProfileFormValues>) => void;
  isOnboarding?: boolean;
  isVerified?: boolean;
  className?: string;
}

export const EditProfileIdentitySection: React.FC<EditProfileIdentitySectionProps> = ({
  formValues,
  onValuesChange,
  isOnboarding = false,
  isVerified = false,
  className,
}) => {
  const limits = useUploadLimits();

  const handleAvatarChange = (next: { avatarUrl: string; avatarFileId: string }) => {
    onValuesChange(next);
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto-transform: lowercase and replace spaces with hyphens
    const value = e.target.value
      .toLowerCase()
      .replace(/\s+/g, '-');
    onValuesChange({ slug: value });
  };

  const profileUrl = formValues.slug ? `https://testkart.in/expert/${formValues.slug}` : null;
  const profilePath = formValues.slug ? `/expert/${formValues.slug}` : null;

  const handleCopyUrl = async () => {
    if (!profileUrl) return;
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast.success('Profile URL copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast.error('Failed to copy URL');
    }
  };

  return (
    <div className={`${styles.section} ${className || ''}`}>
      <h2 className={styles.sectionTitle}>Profile Identity</h2>
      <p className={styles.sectionDescription}>
        This information represents your teaching identity on Testkart.
      </p>

      <TeacherAvatarField
        avatarUrl={formValues.avatarUrl}
        avatarFileId={formValues.avatarFileId}
        displayName={formValues.displayName}
        maxSizeInMB={limits.profilePictureMaxMb}
        onChange={handleAvatarChange}
        className={styles.avatarField}
      />

      <FormItem name="displayName" className={isOnboarding ? styles.onboardingHighlight : ''}>
        <div className={styles.displayNameLabelRow}>
          <FormLabel>Display Name</FormLabel>
          {isVerified && (
            <span className={styles.verifiedIndicator}>
              <BadgeCheck size={16} className={styles.verifiedIcon} />
              <span className={styles.verifiedText}>Verified Teacher</span>
            </span>
          )}
        </div>
        <FormControl>
          <Input
            value={formValues.displayName}
            onChange={(e) => onValuesChange({ displayName: e.target.value })}
            placeholder="Your name"
          />
        </FormControl>
        <FormDescription>This is how students will see your name.</FormDescription>
        <FormMessage />
      </FormItem>

      <FormItem name="slug">
        <FormLabel>Profile URL Slug</FormLabel>
        <FormControl>
          <div className={styles.slugInputWrapper}>
            <span className={styles.slugPrefix}>testkart.in/expert/</span>
            <Input
              value={formValues.slug || ''}
              onChange={handleSlugChange}
              placeholder="your-slug"
              className={styles.slugInput}
            />
          </div>
        </FormControl>
        <FormDescription>Required. This is your permanent profile URL. Choose carefully - changing it may affect your SEO.</FormDescription>
        {profilePath && (
          <div className={styles.slugActions}>
            <Link
              to={profilePath}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.viewProfileLink}
            >
              <ExternalLink size={14} />
              View Public Profile
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopyUrl}
              className={styles.copyButton}
              aria-label="Copy profile URL"
            >
              <Copy size={14} />
              Copy URL
            </Button>
          </div>
        )}
        <FormMessage />
      </FormItem>

      <FormItem name="tagline">
        <FormLabel>Tagline</FormLabel>
        <FormControl>
          <Input
            value={formValues.tagline || ''}
            onChange={(e) => onValuesChange({ tagline: e.target.value })}
            placeholder="Helping students ace their competitive exams"
            maxLength={150}
          />
        </FormControl>
        <FormDescription>A short tagline that describes your value proposition to students (max 150 characters).</FormDescription>
        <FormMessage />
      </FormItem>

      <FormItem name="bio" className={isOnboarding ? styles.onboardingHighlight : ''}>
        <FormLabel>About</FormLabel>
        <FormControl>
          <Textarea
            placeholder="Tell students about yourself and your teaching experience..."
            value={formValues.bio || ''}
            onChange={(e) => onValuesChange({ bio: e.target.value })}
            rows={4}
          />
        </FormControl>
        <FormDescription>A brief description about you and your teaching experience.</FormDescription>
        <FormMessage />
      </FormItem>
    </div>
  );
};