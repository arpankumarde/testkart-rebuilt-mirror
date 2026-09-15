import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './Select';
import { MathMLContent } from './MathMLContent';
import { MatchData } from '../helpers/questionAnswerTypes';
import styles from './QuestionMatchTheFollowing.module.css';

interface QuestionMatchTheFollowingProps {
  questionId: number;
  matchData: MatchData;
  currentMatches: Record<string, string>;
  onAnswerChange: (value: Record<string, string>) => void;
  className?: string;
}

export const QuestionMatchTheFollowing: React.FC<QuestionMatchTheFollowingProps> = ({
  questionId,
  matchData,
  currentMatches,
  onAnswerChange,
  className,
}) => {
  const handleMatchChange = (leftItem: string, rightItem: string) => {
    const newMatches = { ...currentMatches };
    if (rightItem === '__empty') {
      delete newMatches[leftItem];
    } else {
      newMatches[leftItem] = rightItem;
    }
    onAnswerChange(newMatches);
  };

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <p className={styles.instruction}>Match the items from Column A with Column B:</p>
      
      <div className={styles.matchGrid}>
        <div className={styles.columnHeader}>Column A</div>
        <div className={styles.columnHeader}>Column B</div>
        
        {matchData.leftItems.map((leftItem, index) => (
          <React.Fragment key={index}>
            <div className={styles.leftItem}>
              <span className={styles.itemNumber}>{index + 1}.</span>
              <MathMLContent html={leftItem} inline />
            </div>
            
            <div className={styles.rightItemSelect}>
              <Select
                value={currentMatches[leftItem] || '__empty'}
                onValueChange={(value) => handleMatchChange(leftItem, value)}
              >
                <SelectTrigger id={`q${questionId}-match${index}`}>
                  <SelectValue placeholder="Select match" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty">-- Select --</SelectItem>
                  {matchData.rightItems.map((rightItem, rightIndex) => (
                    <SelectItem key={rightIndex} value={rightItem}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                        <span className={styles.rightItemLetter}>
                          {String.fromCharCode(65 + rightIndex)}.
                        </span>
                        <MathMLContent html={rightItem} inline />
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};