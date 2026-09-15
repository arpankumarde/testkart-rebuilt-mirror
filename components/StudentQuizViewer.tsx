import React, { useState, useMemo } from 'react';
import { CheckCircle2, XCircle, ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import { QuizData, QuizQuestion } from './QuizBuilder';
import { Button } from './Button';
import { Progress } from './Progress';
import { Badge } from './Badge';
import { MathMLContent } from './MathMLContent';
import styles from './StudentQuizViewer.module.css';

interface StudentQuizViewerProps {
  quizData: string;
  lessonTitle: string;
  className?: string;
  onQuizCompleted?: (score: number, totalQuestions: number) => void;
}

type QuizState = 'taking' | 'submitted';
type Answers = Record<string, 'A' | 'B' | 'C' | 'D' | null>;

export const StudentQuizViewer: React.FC<StudentQuizViewerProps> = ({
  quizData,
  lessonTitle,
  className,
  onQuizCompleted,
}) => {
  const [quizState, setQuizState] = useState<QuizState>('taking');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});

  const parsedQuiz = useMemo<QuizData | null>(() => {
    try {
      const data = JSON.parse(quizData);
      // Initialize answers state
      if (data && data.questions) {
        const initialAnswers: Answers = {};
        data.questions.forEach((q: QuizQuestion) => {
          initialAnswers[q.id] = null;
        });
        setAnswers(initialAnswers);
      }
      return data;
    } catch (error) {
      console.error('Failed to parse quiz data:', error);
      return null;
    }
  }, [quizData]);

  if (!parsedQuiz || !parsedQuiz.questions || parsedQuiz.questions.length === 0) {
    return (
      <div className={`${styles.container} ${className || ''}`}>
        <div className={styles.errorState}>
          <h3>Invalid Quiz Data</h3>
          <p>This quiz could not be loaded. Please contact the course instructor.</p>
        </div>
      </div>
    );
  }

  const { questions } = parsedQuiz;
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswerSelect = (questionId: string, option: 'A' | 'B' | 'C' | 'D') => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = () => {
    if (window.confirm('Are you sure you want to submit your answers?')) {
      setQuizState('submitted');
      // Calculate score and call callback
      const calculatedScore = questions.reduce((acc, question) => {
        return acc + (answers[question.id] === question.correctAnswer ? 1 : 0);
      }, 0);
      if (onQuizCompleted) {
        onQuizCompleted(calculatedScore, totalQuestions);
      }
    }
  };

  const handleRetake = () => {
    const initialAnswers: Answers = {};
    questions.forEach((q) => {
      initialAnswers[q.id] = null;
    });
    setAnswers(initialAnswers);
    setCurrentQuestionIndex(0);
    setQuizState('taking');
  };

  const score = useMemo(() => {
    if (quizState !== 'submitted') return 0;
    return questions.reduce((acc, question) => {
      return acc + (answers[question.id] === question.correctAnswer ? 1 : 0);
    }, 0);
  }, [quizState, answers, questions]);

  const renderTakingView = () => (
    <>
      <div className={styles.progressContainer}>
        <p className={styles.progressText}>
          Question {currentQuestionIndex + 1} of {totalQuestions}
        </p>
        <Progress value={((currentQuestionIndex + 1) / totalQuestions) * 100} />
      </div>
      <div className={styles.scrollableContent}>
        <div className={styles.questionContent}>
          <h3 className={styles.questionText}>
            <MathMLContent html={currentQuestion.questionText} />
          </h3>
          <div className={styles.optionsContainer}>
            {(['A', 'B', 'C', 'D'] as const).map((option) => {
            const optionText = currentQuestion[`option${option}` as keyof QuizQuestion] as string;
            return (
              <button
                key={option}
                className={`${styles.optionButton} ${
                  answers[currentQuestion.id] === option ? styles.selected : ''
                }`}
                onClick={() => handleAnswerSelect(currentQuestion.id, option)}
              >
                <span className={styles.optionLabel}>{option}</span>
                <span className={styles.optionText}>
                  <MathMLContent html={optionText} inline />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className={styles.navigation}>
        <Button variant="outline" onClick={handlePrevious} disabled={currentQuestionIndex === 0}>
          <ArrowLeft size={16} /> Previous
        </Button>
        {currentQuestionIndex < totalQuestions - 1 ? (
          <Button onClick={handleNext}>
            Next <ArrowRight size={16} />
          </Button>
        ) : (
          <Button onClick={handleSubmit} variant="secondary">
            Submit Quiz
          </Button>
        )}
      </div>
    </>
  );

  const renderSubmittedView = () => (
    <>
      <div className={styles.scrollableContent}>
        <div className={styles.resultsSummary}>
          <h2 className={styles.resultsTitle}>Quiz Results</h2>
          <div className={styles.scoreCircle}>
            <span className={styles.score}>{score}</span>
            <span className={styles.scoreTotal}>/ {totalQuestions}</span>
          </div>
          <p className={styles.scorePercentage}>
            You scored {totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0}%
          </p>
        </div>
        <div className={styles.reviewSection}>
          <h3 className={styles.reviewTitle}>Review Your Answers</h3>
          {questions.map((q, index) => {
          const userAnswer = answers[q.id];
          const isCorrect = userAnswer === q.correctAnswer;
          return (
            <div key={q.id} className={styles.reviewCard}>
              <div className={styles.reviewQuestionHeader}>
                <div className={styles.reviewQuestionText}>
                  <span style={{ marginRight: '0.5rem' }}>{index + 1}.</span>
                  <div style={{ flex: 1 }}>
                    <MathMLContent html={q.questionText} />
                  </div>
                </div>
                {isCorrect ? (
                  <Badge variant="success">Correct</Badge>
                ) : (
                  <Badge variant="destructive">Incorrect</Badge>
                )}
              </div>
              <div className={styles.reviewOptions}>
                {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                  const isUserAnswer = userAnswer === opt;
                  const isCorrectAnswer = q.correctAnswer === opt;
                  let optionClass = styles.reviewOption;
                  if (isCorrectAnswer) optionClass += ` ${styles.correct}`;
                  if (isUserAnswer && !isCorrectAnswer) optionClass += ` ${styles.incorrect}`;

                  return (
                    <div key={opt} className={optionClass}>
                      {isCorrectAnswer && <CheckCircle2 size={16} className={styles.optionIcon} />}
                      {isUserAnswer && !isCorrectAnswer && <XCircle size={16} className={styles.optionIcon} />}
                      <span className={styles.optionLabel}>{opt}</span>
                      <span className={styles.optionText}>
                        <MathMLContent html={q[`option${opt}` as keyof QuizQuestion] as string} inline />
                      </span>
                    </div>
                  );
                })}
              </div>
              {q.explanation && (
                <div className={styles.explanation}>
                  <strong>Explanation:</strong> 
                  <div style={{ marginTop: '0.5rem' }}>
                    <MathMLContent html={q.explanation} />
                  </div>
                </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className={styles.navigation}>
        <Button onClick={handleRetake} variant="outline" className={styles.retakeButton}>
          <RefreshCw size={16} /> Retake Quiz
        </Button>
      </div>
    </>
  );

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.header}>
        <h2>Quiz: {lessonTitle}</h2>
      </div>
      {quizState === 'taking' ? renderTakingView() : renderSubmittedView()}
    </div>
  );
};