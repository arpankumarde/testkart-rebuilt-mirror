import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from './Calendar';
import { Input } from './Input';
import styles from './DatePicker.module.css';

interface DatePickerProps {
  value?: Date;
  onChange: (date?: Date) => void;
  showTime?: boolean;
  disabled?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, showTime = true, disabled = false }) => {
  const [hours, setHours] = useState<string>('00');
  const [minutes, setMinutes] = useState<string>('00');

  // Sync internal time state when value changes
  useEffect(() => {
    if (value) {
      setHours(String(value.getHours()).padStart(2, '0'));
      setMinutes(String(value.getMinutes()).padStart(2, '0'));
    }
  }, [value]);

  const handleDateChange = (newDate?: Date) => {
    if (!newDate) {
      onChange(undefined);
      return;
    }

    // Preserve the current time when date changes
    const updatedDate = new Date(newDate);
    if (showTime) {
      updatedDate.setHours(parseInt(hours) || 0);
      updatedDate.setMinutes(parseInt(minutes) || 0);
    } else {
      updatedDate.setHours(0);
      updatedDate.setMinutes(0);
    }
    updatedDate.setSeconds(0);
    updatedDate.setMilliseconds(0);
    onChange(updatedDate);
  };

  const handleTimeChange = (type: 'hours' | 'minutes', inputValue: string) => {
    // Allow empty string for user to type
    if (inputValue === '') {
      if (type === 'hours') setHours('');
      else setMinutes('');
      return;
    }

    const numValue = parseInt(inputValue);
    
    if (type === 'hours') {
      // Validate hours (0-23)
      if (numValue >= 0 && numValue <= 23) {
        setHours(inputValue);
        updateDateTime(numValue, parseInt(minutes) || 0);
      }
    } else {
      // Validate minutes (0-59)
      if (numValue >= 0 && numValue <= 59) {
        setMinutes(inputValue);
        updateDateTime(parseInt(hours) || 0, numValue);
      }
    }
  };

  const updateDateTime = (newHours: number, newMinutes: number) => {
    const updatedDate = value ? new Date(value) : new Date();
    updatedDate.setHours(newHours);
    updatedDate.setMinutes(newMinutes);
    updatedDate.setSeconds(0);
    updatedDate.setMilliseconds(0);
    onChange(updatedDate);
  };

  const handleTimeBlur = (type: 'hours' | 'minutes') => {
    // Pad with zeros on blur
    if (type === 'hours') {
      const numValue = parseInt(hours) || 0;
      setHours(String(Math.min(23, Math.max(0, numValue))).padStart(2, '0'));
    } else {
      const numValue = parseInt(minutes) || 0;
      setMinutes(String(Math.min(59, Math.max(0, numValue))).padStart(2, '0'));
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        <Button type="button" variant="outline" className={styles.datePickerTrigger} disabled={disabled}>
          {value ? (
            showTime ? value.toLocaleString() : value.toLocaleDateString()
          ) : (
            <span className={styles.placeholder}>{showTime ? "Pick a date and time" : "Pick a date"}</span>
          )}
          <CalendarIcon size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent removeBackgroundAndPadding>
        <div className={styles.datePickerContent}>
          <Calendar 
            mode="single" 
            selected={value} 
            onSelect={handleDateChange} 
            showDropdowns 
            // When selecting dates far in the past (e.g. birth date, work history), 
            // it's helpful to have a wider range.
            fromYear={1960}
            toYear={new Date().getFullYear() + 5}
          />
          {showTime && (
            <div className={styles.timeSection}>
              <label className={styles.timeLabel}>Time:</label>
              <div className={styles.timeInputs}>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={hours}
                  onChange={(e) => handleTimeChange('hours', e.target.value)}
                  onBlur={() => handleTimeBlur('hours')}
                  placeholder="HH"
                  className={styles.timeInput}
                />
                <span className={styles.timeSeparator}>:</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => handleTimeChange('minutes', e.target.value)}
                  onBlur={() => handleTimeBlur('minutes')}
                  placeholder="MM"
                  className={styles.timeInput}
                />
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};