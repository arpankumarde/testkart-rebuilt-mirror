import React from 'react';
import { Globe } from 'lucide-react';
import { FaFacebook, FaInstagram, FaLinkedin, FaXTwitter, FaYoutube } from 'react-icons/fa6';
import { FormItem, FormLabel, FormControl, FormDescription, FormMessage } from './Form';
import { Input } from './Input';
import { TeacherProfileFormValues } from '../helpers/teacherProfileFormSchema';
import styles from './EditProfileSocialSection.module.css';

type SocialKey = keyof NonNullable<TeacherProfileFormValues['socialLinks']>;

const SOCIALS: { key: SocialKey; label: string; placeholder: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'youtube', label: 'YouTube', placeholder: 'youtube.com/@yourchannel', Icon: FaYoutube },
  { key: 'instagram', label: 'Instagram', placeholder: 'instagram.com/yourname', Icon: FaInstagram },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/yourname', Icon: FaLinkedin },
  { key: 'twitter', label: 'X', placeholder: 'x.com/yourname', Icon: FaXTwitter },
  { key: 'facebook', label: 'Facebook', placeholder: 'facebook.com/yourpage', Icon: FaFacebook },
];

interface EditProfileSocialSectionProps {
  formValues: TeacherProfileFormValues;
  onValuesChange: (values: Partial<TeacherProfileFormValues>) => void;
  /** The slug saved on the account, to warn before the live address changes. */
  savedSlug?: string | null;
}

// Profile address, website and social links.
export const EditProfileSocialSection: React.FC<EditProfileSocialSectionProps> = ({
  formValues,
  onValuesChange,
  savedSlug,
}) => {
  const slugChanged = !!savedSlug && !!formValues.slug && formValues.slug !== savedSlug;

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/\s+/g, '-');
    onValuesChange({ slug: value });
  };

  return (
    <div className={styles.fields}>
      <FormItem name="slug">
        <FormLabel>Profile address</FormLabel>
        <div className={styles.affixInput}>
          <span className={styles.prefix} aria-hidden="true">testkart.in/expert/</span>
          <FormControl>
            <Input
              value={formValues.slug || ''}
              onChange={handleSlugChange}
              placeholder="your-name"
              className={styles.bareInput}
              autoCapitalize="none"
              spellCheck={false}
            />
          </FormControl>
        </div>
        <FormDescription className={slugChanged ? styles.warning : undefined}>
          {slugChanged
            ? `Links to testkart.in/expert/${savedSlug} will stop working once you save.`
            : 'Lowercase letters, numbers and hyphens. Keep it stable - shared links use it.'}
        </FormDescription>
        <FormMessage />
      </FormItem>

      <FormItem name="websiteUrl">
        <FormLabel>Website</FormLabel>
        <div className={styles.affixInput}>
          <span className={styles.icon} aria-hidden="true">
            <Globe size={16} />
          </span>
          <FormControl>
            <Input
              placeholder="yourwebsite.com"
              value={formValues.websiteUrl || ''}
              onChange={(e) => onValuesChange({ websiteUrl: e.target.value })}
              className={styles.bareInput}
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
            />
          </FormControl>
        </div>
        <FormMessage />
      </FormItem>

      <fieldset className={styles.socials}>
        <legend className={styles.legend}>Social profiles</legend>
        <div className={styles.grid}>
          {SOCIALS.map(({ key, label, placeholder, Icon }) => (
            <FormItem key={key} name={`socialLinks.${key}`} className={styles.socialItem}>
              <FormLabel className={styles.srOnly}>{label}</FormLabel>
              <div className={styles.affixInput}>
                <span className={styles.icon} aria-hidden="true" title={label}>
                  <Icon size={16} />
                </span>
                <FormControl>
                  <Input
                    placeholder={placeholder}
                    value={formValues.socialLinks?.[key] || ''}
                    onChange={(e) =>
                      onValuesChange({
                        socialLinks: { ...formValues.socialLinks, [key]: e.target.value },
                      })
                    }
                    className={styles.bareInput}
                    inputMode="url"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          ))}
        </div>
      </fieldset>
    </div>
  );
};
