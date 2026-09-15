import React, { useState, useEffect, useRef } from 'react';
import { Input } from './Input';
import { useDebounce } from '../helpers/useDebounce';
import styles from './QuestionNumerical.module.css';

interface QuestionNumericalProps {
  questionId: number;
  currentAnswer?: number;
  onAnswerChange: (value: number | undefined) => void;
  className?: string;
}

export const QuestionNumerical: React.FC<QuestionNumericalProps> = ({
  questionId,
  currentAnswer,
  onAnswerChange,
  className,
}) => {
  const [inputValue, setInputValue] = useState<string>(
    currentAnswer !== undefined ? String(currentAnswer) : ''
  );
  
  const debouncedValue = useDebounce(inputValue, 500);

  // The last value this component pushed up. `currentAnswer` always lags the
  // input by the debounce window, so "the answer is undefined, therefore the
  // box must be stale" is not a safe inference - it is also true for the
  // 500ms after the very first keystroke, and acting on it wiped the digit
  // the moment it was typed. Comparing against what we emitted is what tells
  // a real external change (Clear Response, a restored attempt) apart from
  // that lag.
  const lastEmittedRef = useRef<number | undefined>(currentAnswer);

  useEffect(() => {
    if (currentAnswer === lastEmittedRef.current) return;
    lastEmittedRef.current = currentAnswer;
    setInputValue(currentAnswer !== undefined ? String(currentAnswer) : '');
  }, [currentAnswer]);

  // Use ref to store the latest callback without causing re-renders
  const onAnswerChangeRef = useRef(onAnswerChange);
  
  // Keep ref in sync with latest callback
  useEffect(() => {
    onAnswerChangeRef.current = onAnswerChange;
  }, [onAnswerChange]);

  useEffect(() => {
    if (debouncedValue === '') {
      lastEmittedRef.current = undefined;
      onAnswerChangeRef.current(undefined);
      return;
    }
    // A partial entry like "-" or "3." parses to NaN or drops characters the
    // student is still typing, so leave the stored answer alone until the
    // text is a complete number again.
    const numValue = parseFloat(debouncedValue);
    if (!isNaN(numValue)) {
      lastEmittedRef.current = numValue;
      onAnswerChangeRef.current(numValue);
    }
  }, [debouncedValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow numbers, decimal point, negative sign
    if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
      setInputValue(value);
    }
  };

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <p className={styles.instruction}>Enter your numerical answer:</p>
      <Input
        type="text"
        inputMode="decimal"
        id={`q${questionId}-numerical`}
        value={inputValue}
        onChange={handleChange}
        placeholder="Enter number (e.g., 42 or 3.14)"
        className={styles.input}
      />
      <p className={styles.hint}>
        You can enter integers or decimals. Use negative sign for negative numbers.
      </p>
    </div>
  );
};