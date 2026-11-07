import React, { useState } from 'react';
import { X } from 'lucide-react';
import styles from './ProfileTagInput.module.css';

interface ProfileTagInputProps {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
  label: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}

/*
 * Free-text chips for short lists such as subjects. Enter, Tab or a comma adds
 * what was typed, a pasted comma list adds each part, Backspace on an empty
 * input removes the last chip, and leaving the field keeps a half-typed entry.
 */
export const ProfileTagInput = React.forwardRef<HTMLInputElement, ProfileTagInputProps>(
  (
    {
      id,
      value,
      onChange,
      placeholder = 'Type and press Enter',
      max = 12,
      maxLength = 40,
      label,
      onBlur,
      ...aria
    },
    ref
  ) => {
    const [draft, setDraft] = useState('');
    const [announcement, setAnnouncement] = useState('');
    const atMax = value.length >= max;

    const add = (raw: string[]) => {
      const keys = new Set(value.map((item) => item.toLowerCase()));
      const next = [...value];
      for (const part of raw) {
        const item = part.trim().slice(0, maxLength);
        if (!item || keys.has(item.toLowerCase()) || next.length >= max) continue;
        keys.add(item.toLowerCase());
        next.push(item);
      }
      if (next.length !== value.length) {
        onChange(next);
        setAnnouncement(`${next.slice(value.length).join(', ')} added.`);
      }
      setDraft('');
    };

    const removeAt = (index: number) => {
      const name = value[index];
      onChange(value.filter((_, i) => i !== index));
      setAnnouncement(`${name} removed.`);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if ((event.key === 'Enter' || event.key === ',' || (event.key === 'Tab' && draft.trim())) && !event.nativeEvent.isComposing) {
        if (event.key !== 'Tab' || draft.trim()) event.preventDefault();
        add([draft]);
      } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
        removeAt(value.length - 1);
      }
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const text = event.target.value;
      if (text.includes(',')) {
        const parts = text.split(',');
        const rest = parts.pop() ?? '';
        add(parts);
        setDraft(rest.trimStart());
        return;
      }
      setDraft(text);
    };

    const focusInput = (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      event.currentTarget.querySelector<HTMLInputElement>('input')?.focus();
    };

    return (
      <div className={styles.container}>
        <div className={styles.field} onClick={focusInput}>
          {value.length > 0 && (
            <ul className={styles.chips} role="list" aria-label={label}>
              {value.map((item, index) => (
                <li key={item} className={styles.chip}>
                  <span className={styles.chipName}>{item}</span>
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => removeAt(index)}
                    aria-label={`Remove ${item}`}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={ref}
            id={id}
            className={styles.input}
            value={draft}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={(event) => {
              if (draft.trim()) add([draft]);
              onBlur?.(event);
            }}
            placeholder={atMax ? `Up to ${max}` : value.length === 0 ? placeholder : 'Add another'}
            disabled={atMax}
            maxLength={maxLength}
            aria-describedby={aria['aria-describedby']}
            aria-invalid={aria['aria-invalid']}
          />
        </div>
        <span className={styles.srOnly} aria-live="polite">
          {announcement}
        </span>
      </div>
    );
  }
);

ProfileTagInput.displayName = 'ProfileTagInput';
