import React from 'react';
import { FormItem, FormLabel, FormControl, FormMessage } from './Form';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Button } from './Button';
import { TeacherProfileFormValues } from '../helpers/teacherProfileFormSchema';
import { X, Plus } from 'lucide-react';
import styles from './EditProfileAwardsSection.module.css';

interface EditProfileAwardsSectionProps {
  formValues: TeacherProfileFormValues;
  onValuesChange: (values: Partial<TeacherProfileFormValues>) => void;
}

export const EditProfileAwardsSection: React.FC<EditProfileAwardsSectionProps> = ({
  formValues,
  onValuesChange,
}) => {
  const addAward = () => {
    const currentAwards = formValues.awardsCertificates || [];
    onValuesChange({
      awardsCertificates: [...currentAwards, { title: '', description: '' }]
    });
  };

  const removeAward = (index: number) => {
    const currentAwards = [...(formValues.awardsCertificates || [])];
    currentAwards.splice(index, 1);
    onValuesChange({ awardsCertificates: currentAwards });
  };

  const updateAward = (index: number, field: 'title' | 'description', value: string) => {
    const currentAwards = [...(formValues.awardsCertificates || [])];
    currentAwards[index] = { ...currentAwards[index], [field]: value };
    onValuesChange({ awardsCertificates: currentAwards });
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Awards & Certificates</h2>
      <p className={styles.sectionDescription}>
        Showcase your achievements and qualifications to build credibility.
      </p>

      <FormItem name="awardsCertificates">
        {(formValues.awardsCertificates || []).map((award, index) => (
          <FormItem key={index} name={`awardsCertificates.${index}`} className={styles.awardItem}>
            <div className={styles.awardHeader}>
              <h4 className={styles.awardNumber}>Award {index + 1}</h4>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeAward(index)}
                aria-label="Remove award"
              >
                <X size={16} />
              </Button>
            </div>

            <FormItem name={`awardsCertificates.${index}.title`}>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input
                  value={award.title}
                  onChange={(e) => updateAward(index, 'title', e.target.value)}
                  placeholder="Award or certificate title"
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name={`awardsCertificates.${index}.description`}>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  value={award.description || ''}
                  onChange={(e) => updateAward(index, 'description', e.target.value)}
                  placeholder="Brief description"
                  rows={2}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormItem>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={addAward}
          style={{ marginTop: 'var(--spacing-2)' }}
        >
          <Plus size={16} /> Add Award/Certificate
        </Button>
        <FormMessage />
      </FormItem>
    </div>
  );
};