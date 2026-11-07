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

type PillStatus = 'answered' | 'notAnswered' | 'markedForReview' | 'answeredAndMarked' | 'notVisited';

const STATUS_LABELS: Record<PillStatus, string> = {
  answered: 'Answered',
  notAnswered: 'Not answered',
  markedForReview: 'Marked for review',
  answeredAndMarked: 'Answered and marked for review',
  notVisited: 'Not visited',
};

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

  const isMobile = props.variant === 'mobile';
  const currentSubjectGroup = subjectGroups.find(g => g.name === selectedSubject) ?? subjectGroups[0];
  const currentSubjectQuestions = currentSubjectGroup?.questions ?? [];
  const hasSections = (currentSubjectGroup?.sections.length ?? 0) > 1 ||
    (currentSubjectGroup?.sections.length === 1 && currentSubjectGroup.sections[0].id !== null);

  const enrichedSubjectStats = subjectStats.map(stat => ({
    ...stat,
    timerState: subjectWiseTiming ? subjectTimerStates[stat.name] : undefined,
  }));

  const getStatus = (questionId: number): PillStatus => {
    const isAnswered = answeredIds.has(questionId);
    const isMarked = markedForReview.has(questionId);
    if (isAnswered && isMarked) return 'answeredAndMarked';
    if (isMarked) return 'markedForReview';
    if (isAnswered) return 'answered';
    if (visitedQuestionIds.has(questionId)) return 'notAnswered';
    return 'notVisited';
  };

  const renderPill = (q: ExtendedQuestionData, indexInSubject: number) => {
    const isExpired = questionWiseTiming && expiredQuestionIds.has(q.id);
    const isTimerLocked = questionWiseTiming && q.id !== currentQuestion?.id;
    const isCurrent = q.id === currentQuestion?.id;
    const status = getStatus(q.id);
    const blocked = isExpired || isTimerLocked;
    return (
      <button
        key={q.id}
        type="button"
        ref={isMobile ? (el) => {
          if (props.variant === 'mobile') props.mobileButtonRefs.current[indexInSubject] = el;
        } : undefined}
        className={`${isMobile ? styles.paletteItemMobile : styles.paletteItem} ${styles[status]} ${
          isCurrent ? styles.current : ''
        } ${isExpired ? styles.expired : ''} ${isTimerLocked ? styles.timerLocked : ''}`}
        aria-current={isCurrent ? 'step' : undefined}
        aria-disabled={blocked || undefined}
        aria-label={`Question ${indexInSubject + 1}, ${isExpired ? 'time up' : STATUS_LABELS[status].toLowerCase()}`}
        onClick={() => {
          if (blocked) return;
          onQuestionNavigateInSubject(indexInSubject);
        }}
      >
        {indexInSubject + 1}
      </button>
    );
  };

  if (props.variant === 'mobile') {
    return (
      <div className={`${styles.paletteMobileContainer} ${props.collapsed ? styles.collapsed : ''}`}>
        {!props.collapsed && subjectGroups.length > 1 && (
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
                    {section.questions.map((q) =>
                      renderPill(q, currentSubjectQuestions.findIndex(sq => sq.id === q.id))
                    )}
                  </React.Fragment>
                ))
              : currentSubjectQuestions.map((q, index) => renderPill(q, index))}
          </div>
        </div>
      </div>
    );
  }

  const counts: Record<PillStatus, number> = {
    answered: 0,
    notAnswered: 0,
    markedForReview: 0,
    answeredAndMarked: 0,
    notVisited: 0,
  };
  for (const q of currentSubjectQuestions) counts[getStatus(q.id)]++;

  const legendOrder: PillStatus[] = ['answered', 'notAnswered', 'markedForReview', 'notVisited', 'answeredAndMarked'];

  return (
    <div className={styles.palette}>
      {subjectWiseTiming ? (
        <div className={styles.subjectTabsWrapper}>
          {subjectGroups.map((group) => {
            const timerState = subjectTimerStates[group.name];
            const submitted = timerState?.submitted === true;
            const isSelected = group.name === selectedSubject;
            const stat = subjectStats.find(s => s.name === group.name);
            const isLocked = !isSelected && !submitted;
            const isDisabled = submitted || isLocked || (questionWiseTiming && !isSelected);
            const title = submitted ? `${group.name} - Submitted` : isLocked ? 'Finish the current subject first' : group.name;

            return (
              <button
                key={group.name}
                type="button"
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
                    <Lock size={12} className={styles.subjectTabLock} aria-label={submitted ? 'Submitted' : 'Locked'} />
                  ) : timerState ? (
                    <span className={`${styles.subjectTabTimer} ${timerState.remaining < 300 ? styles.subjectTabTimerWarning : ''}`}>
                      {formatSubjectTime(timerState.remaining)}
                    </span>
                  ) : null}
                </div>
                {stat && (
                  <span className={styles.subjectTabCount}>
                    {stat.answeredQuestions}/{stat.totalQuestions} answered
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : subjectGroups.length > 1 ? (
        <SubjectTabs
          subjects={subjectStats}
          currentSubject={selectedSubject}
          onSubjectChange={onSubjectChange}
          disabled={questionWiseTiming}
        />
      ) : null}

      <ul className={styles.statusLegend} aria-label="What the colours mean">
        {legendOrder.map((status) => (
          <li
            key={status}
            className={`${styles.legendItem} ${status === 'answeredAndMarked' ? styles.legendItemWide : ''}`}
          >
            <span className={`${styles.legendDot} ${styles[status]}`}>{counts[status]}</span>
            <span>{STATUS_LABELS[status]}</span>
          </li>
        ))}
      </ul>

      {currentSubjectGroup?.maxAttemptsAllowed !== null && (
        <div className={styles.subjectAttemptLimit}>
          {currentSubjectGroup.questions.filter(q => answeredIds.has(q.id)).length} of {currentSubjectGroup.maxAttemptsAllowed} allowed answers used
        </div>
      )}

      {hasSections
        ? currentSubjectGroup?.sections.map((section) => (
            <div key={section.id ?? 'general'} className={styles.sectionGroup}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionLabel}>{section.name}</span>
                {section.maxAttemptsAllowed !== null && (
                  <span className={styles.sectionLimit}>
                    {section.questions.filter(q => answeredIds.has(q.id)).length}/{section.maxAttemptsAllowed} allowed
                  </span>
                )}
              </div>
              <div className={styles.paletteGrid}>
                {section.questions.map((q) =>
                  renderPill(q, currentSubjectQuestions.findIndex(sq => sq.id === q.id))
                )}
              </div>
            </div>
          ))
        : (
          <div className={styles.paletteGrid}>
            {currentSubjectQuestions.map((q, index) => renderPill(q, index))}
          </div>
        )}
    </div>
  );
};
