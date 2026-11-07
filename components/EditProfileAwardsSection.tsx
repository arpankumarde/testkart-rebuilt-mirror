import React from 'react';
import { Award, Plus, Trash2 } from 'lucide-react';
import { FormItem, FormLabel, FormControl, FormMessage } from './Form';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Button } from './Button';
import { TeacherProfileFormValues } from '../helpers/teacherProfileFormSchema';
import styles from './EditProfileAwardsSection.module.css';

interface EditProfileAwardsSectionProps {
  formValues: TeacherProfileFormValues;
  onValuesChange: (values: Partial<TeacherProfileFormValues>) => void;
}

export const EditProfileAwardsSection: React.FC<EditProfileAwardsSectionProps> = ({
  formValues,
  onValuesChange,
}) => {
  const awards = formValues.awardsCertificates || [];

  const addAward = () => {
    onValuesChange({ awardsCertificates: [...awards, { title: '', description: '' }] });
    // Focus lands on the new title once it has rendered.
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>(`[data-award-title="${awards.length}"]`)?.focus();
    });
  };

  const removeAward = (index: number) => {
    onValuesChange({ awardsCertificates: awards.filter((_, i) => i !== index) });
  };

  const updateAward = (index: number, field: 'title' | 'description', value: string) => {
    const next = [...awards];
    next[index] = { ...next[index], [field]: value };
    onValuesChange({ awardsCertificates: next });
  };

  return (
    <div className={styles.wrap}>
      {awards.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <Award size={20} />
          </span>
          <p className={styles.emptyText}>
            Degrees, teaching certificates, toppers you coached or exams you cleared yourself.
          </p>
        </div>
      ) : (
        <ol className={styles.list}>
          {awards.map((award, index) => (
            <li key={index} className={styles.item}>
              <div className={styles.itemFields}>
                <FormItem name={`awardsCertificates.${index}.title`}>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      data-award-title={index}
                      value={award.title}
                      onChange={(e) => updateAward(index, 'title', e.target.value)}
                      placeholder="e.g. UGC NET JRF, Commerce"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name={`awardsCertificates.${index}.description`}>
                  <FormLabel>
                    Details <span className={styles.optional}>Optional</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      value={award.description || ''}
                      onChange={(e) => updateAward(index, 'description', e.target.value)}
                      placeholder="Year, issuing body or what it took"
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={styles.remove}
                onClick={() => removeAward(index)}
                aria-label={award.title ? `Remove ${award.title}` : `Remove entry ${index + 1}`}
              >
                <Trash2 size={16} />
              </Button>
            </li>
          ))}
        </ol>
      )}

      <Button type="button" variant="outline" onClick={addAward} className={styles.add}>
        <Plus size={16} /> Add an award or certificate
      </Button>
    </div>
  );
};
