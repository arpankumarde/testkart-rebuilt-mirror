import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './Select';
import { Lock } from 'lucide-react';
import styles from './SubjectSelector.module.css';

interface SubjectInfo {
  name: string;
  totalQuestions: number;
  answeredQuestions: number;
}

interface SubjectSelectorProps {
  subjects: SubjectInfo[];
  currentSubject: string;
  currentSubjectIndex: number;
  onSubjectChange: (subjectName: string) => void;
  subjectWiseTiming?: boolean;
  activeSubject?: string;
  disabled?: boolean;
}

export const SubjectSelector: React.FC<SubjectSelectorProps> = ({
  subjects,
  currentSubject,
  currentSubjectIndex,
  onSubjectChange,
  subjectWiseTiming,
  activeSubject,
  disabled,
}) => {
  return (
    <div className={`${styles.subjectSelector} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.subjectIndicator}>
        Subject {currentSubjectIndex + 1} of {subjects.length}
      </div>
      <Select value={currentSubject} onValueChange={onSubjectChange} disabled={disabled}>
        <SelectTrigger className={styles.selectTrigger}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {subjects.map((subject) => {
            const isLocked = subjectWiseTiming && subject.name !== activeSubject;
            
            return (
              <SelectItem 
                key={subject.name} 
                value={subject.name}
                disabled={!!isLocked}
                className={isLocked ? styles.lockedItem : ''}
              >
                <div className={styles.selectItemContent}>
                  <div className={styles.nameContainer}>
                    {isLocked && <Lock className={styles.lockIcon} size={14} />}
                    <span className={styles.selectItemName}>{subject.name}</span>
                  </div>
                  <span className={styles.selectItemCount}>
                    {subject.answeredQuestions}/{subject.totalQuestions}
                  </span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};