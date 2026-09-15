import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FileText, Clock, BookOpen, ChevronDown, ChevronUp, Info, Calendar, CheckCircle } from 'lucide-react';
import { useAuth } from '../helpers/useAuth';
import { Badge } from './Badge';
import { Button } from './Button';
import type { TestItem } from '../endpoints/tests/details_GET.schema';
import { useAddToCartMutation } from '../helpers/useCartQuery';
import styles from './TestItemsList.module.css';

interface TestItemsListProps {
  className?: string;
  items: TestItem[];
  isEnrolled: boolean;
  packageId: number;
}

export const TestItemsList: React.FC<TestItemsListProps> = ({ className, items, isEnrolled, packageId }) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { mutate: addToCart, isPending } = useAddToCartMutation();
  const { authState } = useAuth();
  
  const isTeacher = authState.type === 'authenticated' && authState.user.role === 'teacher';
  const now = new Date();

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleUnlockTests = () => {
    // Check if user is authenticated
    if (authState.type !== 'authenticated') {
      // Redirect to login with current page as redirect target
      const currentPath = location.pathname;
      navigate(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
      return;
    }

    // User is authenticated, proceed with adding to cart
    addToCart(
      { mockTestId: packageId },
      {
        onSuccess: () => {
          navigate('/cart');
        },
      }
    );
  };

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {items.map((item) => {
        const isExpanded = expandedId === item.id;
        const isFuture = item.scheduledDate ? new Date(item.scheduledDate) > now : false;
        const formattedDate = item.scheduledDate 
          ? new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(item.scheduledDate)) 
          : '';
        
        return (
          <div key={item.id} className={styles.item}>
            <div 
              className={styles.itemHeader} 
              onClick={() => toggleExpand(item.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleExpand(item.id);
                }
              }}
            >
              {/* First Row: Icon + Title + Free Badge */}
              <div className={styles.itemHeaderTop}>
                <FileText size={20} className={styles.icon} />
                <h3 className={styles.itemTitle}>{item.title}</h3>
                {item.isFree && (
                  <Badge variant="success" className={styles.freeBadge}>
                    Free
                  </Badge>
                )}
              </div>

              {/* Second Row: Metadata + Chevron */}
              <div className={styles.itemHeaderBottom}>
                <div className={styles.metadata}>
                  <div className={styles.metadataItem}>
                    <BookOpen size={16} />
                    <span>{item.totalQuestions} Questions</span>
                  </div>
                  {item.durationMinutes !== undefined && item.durationMinutes !== null && (
                    <div className={styles.metadataItem}>
                      <Clock size={16} />
                      <span>{item.durationMinutes > 0 ? `${item.durationMinutes} mins` : "No Time Limit"}</span>
                    </div>
                  )}
                  {isFuture ? (
                    <div className={`${styles.metadataItem} ${styles.scheduledBadge}`}>
                      <Calendar size={16} />
                      <span>Opens {formattedDate}</span>
                    </div>
                  ) : (
                    <div className={`${styles.metadataItem} ${styles.availableBadge}`}>
                      <CheckCircle size={16} />
                      <span>Available Now</span>
                    </div>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp size={20} className={styles.chevron} />
                ) : (
                  <ChevronDown size={20} className={styles.chevron} />
                )}
              </div>
            </div>

            {isExpanded && (
              <div className={styles.itemContent}>
                {item.description && (
                  <p className={styles.description}>{item.description}</p>
                )}

                {item.subjects.length > 0 && (
                  <div className={styles.subjectsSection}>
                    <h4 className={styles.subjectsHeading}>Subjects Covered</h4>
                    <div className={styles.subjectsGrid}>
                      {item.subjects.map((subject) => (
                        <Badge 
                          key={subject.id} 
                          variant="secondary" 
                          className={styles.subjectBadge}
                        >
                          {subject.subjectName} ({subject.actualQuestionCount})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {!isTeacher && (
                  <div className={styles.actions}>
                    {item.isFree ? (
                      isFuture ? (
                        <Button size="lg" disabled>
                          Opens {formattedDate}
                        </Button>
                      ) : (
                        <Button size="lg" asChild>
                          <Link to={authState.type === 'authenticated' ? `/portal/${item.id}` : `/login?redirectTo=/portal/${item.id}`}>
                            Start Free Test
                          </Link>
                        </Button>
                      )
                    ) : isEnrolled ? (
                      isFuture ? (
                        <Button size="lg" disabled>
                          Opens {formattedDate}
                        </Button>
                      ) : (
                        <Button size="lg" asChild>
                          <Link to={authState.type === 'authenticated' ? `/portal/${item.id}` : `/login?redirectTo=/portal/${item.id}`}>
                            Start Test
                          </Link>
                        </Button>
                      )
                    ) : (
                      <Button 
                        size="lg" 
                        onClick={handleUnlockTests}
                        disabled={isPending}
                      >
                        {isPending ? 'Adding to Cart...' : 'Unlock'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};