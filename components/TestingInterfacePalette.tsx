import React from 'react';
import { Lock } from 'lucide-react';
import { SubjectTabs } from './SubjectTabs';
import { SubjectSelector } from './SubjectSelector';
import {
  SubjectGroupWithSections,
  SubjectStat,
  SubjectTimerState,
  isSubjectSubmitted,
} from '../helpers/testingInterfaceTypes';
import { ExtendedQuestionData } from '../helpers/testingInterfaceTypes';
import styles from './TestingInterfacePalette.module.css';

interface PaletteBaseProps {
  subjectStats: SubjectStat[];
  subjectGroups: SubjectGroupWithSections[];
  selectedSubject: string;
  currentSubjectIndex: number;
  currentQuestion: ExtendedQuestionData | undefined;
  answeredIds: Set<number>;
  markedForReview?: Set<number>;
  visitedQuestionIds?: Set<number>;
  onSubjectChange: (subjectName: string) => void;
  onQuestionNavigateInSubject: (indexInSubject: number) => void;
  subjectWiseTiming?: boolean;
  subjectTimerStates?: SubjectTimerState;
  questionWiseTiming?: boolean;
  expiredQuestionIds?: Set<number>;
}

interface DesktopPaletteProps extends PaletteBaseProps {
  variant: 'desktop';
}

interface MobilePaletteProps extends PaletteBaseProps {
  variant: 'mobile';
  mobileButtonRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  collapsed?: boolean;
}

type TestingInterfacePaletteProps = DesktopPaletteProps | MobilePaletteProps;

function isMobileProps(props: TestingInterfacePaletteProps): props is MobilePaletteProps {
  return props.variant === 'mobile';
}

function formatSubjectTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const TestingInterfacePalette: React.FC<TestingInterfacePaletteProps> = (props) => {
  const {
    subjectStats,
    subjectGroups,
    selectedSubject,
    currentSubjectIndex,
    currentQuestion,
    answeredIds,
    markedForReview = new Set(),
    visitedQuestionIds = new Set(),
    onSubjectChange,
    onQuestionNavigateInSubject,
    subjectWiseTiming = false,
    subjectTimerStates = {},
    questionWiseTiming = false,
    expiredQuestionIds = new Set(),
  } = props;

  const currentSubjectGroup = subjectGroups.find(g => g.name === selectedSubject) ?? subjectGroups[0];
  const currentSubjectQuestions = currentSubjectGroup?.questions ?? [];
  const hasSections = (currentSubjectGroup?.sections.length ?? 0) > 1 ||
    (currentSubjectGroup?.sections.length === 1 && currentSubjectGroup.sections[0].id !== null);

  // Build enriched subject stats with timer info for display
  const enrichedSubjectStats = subjectStats.map(stat => ({
    ...stat,
    timerState: subjectWiseTiming ? subjectTimerStates[stat.name] : undefined,
  }));

  const getPillStatusClass = (questionId: number) => {
    const isAnswered = answeredIds.has(questionId);
    const isMarked = markedForReview.has(questionId);
    const isVisited = visitedQuestionIds.has(questionId);
  
    if (isAnswered && isMarked) return styles.answeredAndMarked;
    if (isMarked) return styles.markedForReview;
    if (isAnswered) return styles.answered;
    if (isVisited) return styles.notAnswered;
    return styles.notVisited;
  };

  if (props.variant === 'mobile') {
    return (
      <div className={`${styles.paletteMobileContainer} ${props.collapsed ? styles.collapsed : ''}`}>
        {!props.collapsed && (
          <SubjectSelector
            subjects={enrichedSubjectStats}
            currentSubject={selectedSubject}
            currentSubjectIndex={currentSubjectIndex}
            subjectWiseTiming={subjectWiseTiming}
            activeSubject={selectedSubject}
            disabled={questionWiseTiming}
            onSubjectChange={(name) => {
              if (subjectWiseTiming) {
                if (isSubjectSubmitted(name, subjectTimerStates)) return;
                if (name !== selectedSubject) return;
              }
              onSubjectChange(name);
            }}
          />
        )}
        <div className={styles.paletteMobile}>
          <div className={styles.paletteMobileScroll}>
            {hasSections
              ? currentSubjectGroup?.sections.map((section) => (
                  <React.Fragment key={section.id ?? 'general'}>
                    <span className={styles.sectionLabelMobile}>{section.name}</span>
                    {section.questions.map((q) => {
                      const indexInSubject = currentSubjectQuestions.findIndex(sq => sq.id === q.id);
                      const isExpired = questionWiseTiming && expiredQuestionIds.has(q.id);
                      const isTimerLocked = questionWiseTiming && q.id !== currentQuestion?.id;
                      const expiredClass = isExpired ? styles.expired : '';
                      const lockedClass = isTimerLocked ? styles.timerLocked : '';
                      const statusClass = getPillStatusClass(q.id);
                      return (
                        <button
                          key={q.id}
                          ref={(el) => {
                            if (isMobileProps(props)) {
                              props.mobileButtonRefs.current[indexInSubject] = el;
                            }
                          }}
                          className={`${styles.paletteItemMobile} ${
                            q.id === currentQuestion?.id ? styles.current : ''
                          } ${statusClass} ${expiredClass} ${lockedClass}`}
                          onClick={() => {
                            if (isExpired || isTimerLocked) return;
                            onQuestionNavigateInSubject(indexInSubject);
                          }}
                        >
                          {indexInSubject + 1}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))
              : currentSubjectQuestions.map((q, index) => {
                  const isExpired = questionWiseTiming && expiredQuestionIds.has(q.id);
                  const isTimerLocked = questionWiseTiming && q.id !== currentQuestion?.id;
                  const expiredClass = isExpired ? styles.expired : '';
                  const lockedClass = isTimerLocked ? styles.timerLocked : '';
                  const statusClass = getPillStatusClass(q.id);
                  return (
                    <button
                      key={q.id}
                      ref={(el) => {
                        if (isMobileProps(props)) {
                          props.mobileButtonRefs.current[index] = el;
                        }
                      }}
                      className={`${styles.paletteItemMobile} ${
                        q.id === currentQuestion?.id ? styles.current : ''
                      } ${statusClass} ${expiredClass} ${lockedClass}`}
                      onClick={() => {
                        if (isExpired || isTimerLocked) return;
                        onQuestionNavigateInSubject(index);
                      }}
                    >
                      {index + 1}
                    </button>
                  );
                })}
          </div>
        </div>
      </div>
    );
  }

  // Compute counts for the status legend
  let countAnswered = 0;
  let countNotAnswered = 0;
  let countMarked = 0;
  let countAnsweredMarked = 0;
  let countNotVisited = 0;

  for (const q of currentSubjectQuestions) {
    const isAns = answeredIds.has(q.id);
    const isMark = markedForReview.has(q.id);
    const isVis = visitedQuestionIds.has(q.id);

    if (isAns && isMark) countAnsweredMarked++;
    else if (isMark) countMarked++;
    else if (isAns) countAnswered++;
    else if (isVis) countNotAnswered++;
    else countNotVisited++;
  }

  // Desktop palette
  return (
    <div className={styles.palette}>
      <div className={styles.statusLegend}>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.answered}`}>{countAnswered}</div>
          <span>Answered</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.notAnswered}`}>{countNotAnswered}</div>
          <span>Not Answered</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.notVisited}`}>{countNotVisited}</div>
          <span>Not Visited</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.markedForReview}`}>{countMarked}</div>
          <span>Marked</span>
        </div>
        <div className={styles.legendItem} style={{ gridColumn: '1 / -1' }}>
          <div className={`${styles.legendDot} ${styles.answeredAndMarked}`}>{countAnsweredMarked}</div>
          <span>Answered & Marked for Review</span>
        </div>
      </div>

      {subjectWiseTiming ? (
        // Subject-wise timing: render subject tabs with lock icons and timers
        <div className={styles.subjectTabsWrapper}>
          {subjectGroups.map((group) => {
            const timerState = subjectTimerStates[group.name];
            const submitted = timerState?.submitted === true;
            const isSelected = group.name === selectedSubject;
            const stat = subjectStats.find(s => s.name === group.name);
            const isLocked = !isSelected && !submitted;
            const isDisabled = submitted || isLocked || (questionWiseTiming && !isSelected);
            const title = submitted ? `${group.name} - Submitted` : isLocked ? 'Complete current subject first' : group.name;

            return (
              <button
                key={group.name}
                className={`${styles.subjectTabItem} ${isSelected ? styles.subjectTabActive : ''} ${isDisabled ? styles.subjectTabLocked : ''}`}
                onClick={() => {
                  if (!isDisabled) onSubjectChange(group.name);
                }}
                disabled={isDisabled}
                title={title}
              >
                <div className={styles.subjectTabContent}>
                  <span className={styles.subjectTabName}>{group.name}</span>
                  {submitted || isLocked ? (
                    <Lock size={12} className={styles.subjectTabLock} />
                  ) : timerState ? (
                    <span className={`${styles.subjectTabTimer} ${timerState.remaining < 300 ? styles.subjectTabTimerWarning : ''}`}>
                      {formatSubjectTime(timerState.remaining)}
                    </span>
                  ) : null}
                </div>
                {stat && (
                  <span className={styles.subjectTabCount}>
                    {stat.answeredQuestions}/{stat.totalQuestions}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <SubjectTabs
          subjects={subjectStats}
          currentSubject={selectedSubject}
          onSubjectChange={onSubjectChange}
          disabled={questionWiseTiming}
        />
      )}
      <h4>Questions</h4>
      {currentSubjectGroup?.maxAttemptsAllowed !== null && !hasSections && (
        <div className={styles.subjectAttemptLimit}>
          Attempt {currentSubjectGroup.questions.filter(q => answeredIds.has(q.id)).length} / {currentSubjectGroup.maxAttemptsAllowed} questions
        </div>
      )}
      {currentSubjectGroup?.maxAttemptsAllowed !== null && hasSections && (
        <div className={styles.subjectAttemptLimit}>
          Subject limit: {currentSubjectGroup.questions.filter(q => answeredIds.has(q.id)).length} / {currentSubjectGroup.maxAttemptsAllowed}
        </div>
      )}
      {hasSections
        ? currentSubjectGroup?.sections.map((section) => (
            <div key={section.id ?? 'general'} className={styles.sectionGroup}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionLabel}>{section.name}</span>
                {section.maxAttemptsAllowed !== null && (
                  <span className={styles.sectionLimit}>
                    {section.questions.filter(q => answeredIds.has(q.id)).length}/{section.maxAttemptsAllowed} answered
                  </span>
                )}
              </div>
              <div className={styles.paletteGrid}>
                {section.questions.map((q) => {
                  const indexInSubject = currentSubjectQuestions.findIndex(sq => sq.id === q.id);
                  const isExpired = questionWiseTiming && expiredQuestionIds.has(q.id);
                  const isTimerLocked = questionWiseTiming && q.id !== currentQuestion?.id;
                  const expiredClass = isExpired ? styles.expired : '';
                  const lockedClass = isTimerLocked ? styles.timerLocked : '';
                  const statusClass = getPillStatusClass(q.id);
                  return (
                    <button
                      key={q.id}
                      className={`${styles.paletteItem} ${
                        q.id === currentQuestion?.id ? styles.current : ''
                      } ${statusClass} ${expiredClass} ${lockedClass}`}
                      onClick={() => {
                        if (isExpired || isTimerLocked) return;
                        onQuestionNavigateInSubject(indexInSubject);
                      }}
                    >
                      {indexInSubject + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        : (
          <div className={styles.paletteGrid}>
            {currentSubjectQuestions.map((q, index) => {
              const isExpired = questionWiseTiming && expiredQuestionIds.has(q.id);
              const isTimerLocked = questionWiseTiming && q.id !== currentQuestion?.id;
              const expiredClass = isExpired ? styles.expired : '';
              const lockedClass = isTimerLocked ? styles.timerLocked : '';
              const statusClass = getPillStatusClass(q.id);
              return (
                <button
                  key={q.id}
                  className={`${styles.paletteItem} ${
                    q.id === currentQuestion?.id ? styles.current : ''
                  } ${statusClass} ${expiredClass} ${lockedClass}`}
                  onClick={() => {
                    if (isExpired || isTimerLocked) return;
                    onQuestionNavigateInSubject(index);
                  }}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
};