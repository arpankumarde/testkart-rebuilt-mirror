import React from 'react';
import { RadioGroup, RadioGroupItem } from './RadioGroup';
import { MathMLContent } from './MathMLContent';
import { MCQOption } from '../helpers/questionAnswerTypes';
import styles from './QuestionComprehension.module.css';

interface QuestionComprehensionProps {
  questionId: number;
  paragraphText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE?: string;
  selectedOption?: MCQOption;
  onAnswerChange: (value: MCQOption) => void;
  className?: string;
}

export const QuestionComprehension: React.FC<QuestionComprehensionProps> = ({
  questionId,
  paragraphText,
  optionA,
  optionB,
  optionC,
  optionD,
  optionE,
  selectedOption,
  onAnswerChange,
  className,
}) => {
  const optionKeys = React.useMemo(() => {
    const keys: MCQOption[] = ['A', 'B', 'C', 'D'];
    if (optionE) keys.push('E');
    return keys;
  }, [optionE]);

  const optionMap: Record<string, string> = { A: optionA, B: optionB, C: optionC, D: optionD };
  if (optionE) optionMap.E = optionE;

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.paragraphBox}>
        <h4 className={styles.paragraphHeading}>Passage</h4>
        <div className={styles.paragraphContent}>
          <MathMLContent html={paragraphText} />
        </div>
      </div>

      <RadioGroup
        key={selectedOption || 'cleared'}
        className={styles.optionsGroup}
        value={selectedOption}
        onValueChange={(value) => onAnswerChange(value as MCQOption)}
      >
        {optionKeys.map((opt) => (
          <label
            key={opt}
            className={`${styles.optionLabel} ${selectedOption === opt ? styles.selected : ''}`}
          >
            <span className={styles.control}>
              <RadioGroupItem value={opt} id={`q${questionId}-opt${opt}`} />
            </span>
            <span className={styles.optionLetter} aria-hidden="true">{opt}</span>
            <span className={styles.optionText}>
              <MathMLContent html={optionMap[opt]} inline />
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
};
