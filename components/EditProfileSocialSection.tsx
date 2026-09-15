import React from 'react';
import { FormItem, FormLabel, FormControl, FormDescription, FormMessage } from './Form';
import { Input } from './Input';
import { TeacherProfileFormValues } from '../helpers/teacherProfileFormSchema';
import styles from './EditProfileSocialSection.module.css';

interface EditProfileSocialSectionProps {
  formValues: TeacherProfileFormValues;
  onValuesChange: (values: Partial<TeacherProfileFormValues>) => void;
}

export const EditProfileSocialSection: React.FC<EditProfileSocialSectionProps> = ({
  formValues,
  onValuesChange,
}) => {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Contact & Social Links</h2>
      <p className={styles.sectionDescription}>
        Share your contact details and social media profiles so students can connect with you.
      </p>

            <FormItem name="websiteUrl">
        <FormLabel>Website URL</FormLabel>
        <FormControl>
          <Input
            placeholder="www.yourwebsite.com"
            value={formValues.websiteUrl || ''}
            onChange={(e) => onValuesChange({ websiteUrl: e.target.value })}
          />
        </FormControl>
        <FormDescription>Your personal or academy website.</FormDescription>
        <FormMessage />
      </FormItem>

      <FormItem name="location">
        <FormLabel>Location</FormLabel>
        <FormControl>
          <Input
            placeholder="Mumbai, India"
            value={formValues.location || ''}
            onChange={(e) => onValuesChange({ location: e.target.value })}
          />
        </FormControl>
        <FormDescription>Where you are based. Helps students find local teachers.</FormDescription>
        <FormMessage />
      </FormItem>

      <FormItem name="languages">
        <FormLabel>Languages</FormLabel>
        <FormControl>
          <Input
            placeholder="Hindi, English, Marathi"
            value={formValues.languages?.join(', ') || ''}
            onChange={(e) => {
              const val = e.target.value;
              const arr = val.split(',').map(s => s.trim()).filter(Boolean);
              onValuesChange({ languages: arr });
            }}
          />
        </FormControl>
        <FormDescription>Languages you teach in (comma separated, e.g. Hindi, English, Marathi).</FormDescription>
        <FormMessage />
      </FormItem>

      <FormItem name="expertiseAreas">
        <FormLabel>Expertise Areas</FormLabel>
        <FormControl>
          <Input
            placeholder="Mathematics, Physics, JEE"
            value={formValues.expertiseAreas?.join(', ') || ''}
            onChange={(e) => {
              const val = e.target.value;
              const arr = val.split(',').map(s => s.trim()).filter(Boolean);
              onValuesChange({ expertiseAreas: arr });
            }}
          />
        </FormControl>
        <FormDescription>Your areas of expertise (comma separated, e.g. Mathematics, Physics, JEE).</FormDescription>
        <FormMessage />
      </FormItem>

            <FormItem name="socialLinks.facebook">
        <FormLabel>Facebook</FormLabel>
        <FormControl>
          <Input
            placeholder="https://facebook.com/yourprofile"
            value={formValues.socialLinks?.facebook || ''}
            onChange={(e) => onValuesChange({
              socialLinks: { ...formValues.socialLinks, facebook: e.target.value }
            })}
          />
        </FormControl>
        <FormMessage />
      </FormItem>

      <FormItem name="socialLinks.twitter">
        <FormLabel>Twitter</FormLabel>
        <FormControl>
          <Input
            placeholder="https://twitter.com/yourprofile"
            value={formValues.socialLinks?.twitter || ''}
            onChange={(e) => onValuesChange({
              socialLinks: { ...formValues.socialLinks, twitter: e.target.value }
            })}
          />
        </FormControl>
        <FormMessage />
      </FormItem>

      <FormItem name="socialLinks.linkedin">
        <FormLabel>LinkedIn</FormLabel>
        <FormControl>
          <Input
            placeholder="https://linkedin.com/in/yourprofile"
            value={formValues.socialLinks?.linkedin || ''}
            onChange={(e) => onValuesChange({
              socialLinks: { ...formValues.socialLinks, linkedin: e.target.value }
            })}
          />
        </FormControl>
        <FormMessage />
      </FormItem>

      <FormItem name="socialLinks.instagram">
        <FormLabel>Instagram</FormLabel>
        <FormControl>
          <Input
            placeholder="https://instagram.com/yourprofile"
            value={formValues.socialLinks?.instagram || ''}
            onChange={(e) => onValuesChange({
              socialLinks: { ...formValues.socialLinks, instagram: e.target.value }
            })}
          />
        </FormControl>
        <FormMessage />
      </FormItem>

      <FormItem name="socialLinks.youtube">
        <FormLabel>YouTube</FormLabel>
        <FormControl>
          <Input
            placeholder="https://youtube.com/@yourchannel"
            value={formValues.socialLinks?.youtube || ''}
            onChange={(e) => onValuesChange({
              socialLinks: { ...formValues.socialLinks, youtube: e.target.value }
            })}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    </div>
  );
};