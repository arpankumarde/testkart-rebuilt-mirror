import React from 'react';
import { CheckCircle } from 'lucide-react';
import styles from './SubjectTabs.module.css';

interface SubjectInfo {
  name: string;
  totalQuestions: number;
  answeredQuestions: number;
}

interface SubjectTabsProps {
  subjects: SubjectInfo[];
  currentSubject: string;
  onSubjectChange: (subjectName: string) => void;
  disabled?: boolean;
}

export const SubjectTabs: React.FC<SubjectTabsProps> = ({
  subjects,
  currentSubject,
  onSubjectChange,
  disabled,
}) => {
  return (
    <div className={styles.subjectTabs}>
      {subjects.map((subject) => (
        <button
          key={subject.name}
          disabled={disabled}
          className={`${styles.subjectTab} ${
            subject.name === currentSubject ? styles.active : ''
          } ${disabled ? styles.disabled : ''}`}
          onClick={() => onSubjectChange(subject.name)}
        >
          <span className={styles.subjectName}>{subject.name}</span>
          <span className={styles.subjectCount}>
            {subject.answeredQuestions > 0 && (
              <CheckCircle size={14} className={styles.checkIcon} />
            )}
            {subject.answeredQuestions}/{subject.totalQuestions}
          </span>
        </button>
      ))}
    </div>
  );
};