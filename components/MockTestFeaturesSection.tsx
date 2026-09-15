import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";
import {
  CheckCircle, CheckSquare, Hash, GitCompare, FileText, BookOpen,
  Clock, List, Palette, Bookmark, Save, MinusCircle, PieChart, Calculator, Timer,
  Trophy, BarChart2, Star,
  Sparkles, Upload, Layers, Package, Tag, Award, Heart, Layout, ShieldCheck, BarChart, DollarSign, Unlock
} from "lucide-react";
import styles from "./MockTestFeaturesSection.module.css";

export const MockTestFeaturesSection: React.FC = () => {
  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <h2>Explore the Platform</h2>
        <p>Everything you need to create, manage, and analyze mock tests.</p>
      </div>

      <Tabs defaultValue="question-types" className={styles.tabsContainer}>
        <div className={styles.tabsListWrapper}>
          <TabsList>
            <TabsTrigger value="question-types">Question Types</TabsTrigger>
            <TabsTrigger value="test-interface">Test Interface</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="platform-tools">Platform Tools</TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Question Types */}
        <TabsContent value="question-types" className={styles.tabContent}>
          <div className={styles.questionTypesGrid}>
            <div className={styles.questionCard}>
              <CheckCircle size={20} className={styles.iconPrimary} />
              <h3>Single Correct MCQ</h3>
              <p>Standard multiple choice questions with four options and one correct answer.</p>
            </div>
            <div className={styles.questionCard}>
              <CheckSquare size={20} className={styles.iconPrimary} />
              <h3>Multiple Correct MCQ</h3>
              <p>Questions where more than one option can be correct. Ideal for JEE Advanced.</p>
            </div>
            <div className={styles.questionCard}>
              <Hash size={20} className={styles.iconPrimary} />
              <h3>Numerical Value</h3>
              <p>Students enter a numerical answer. Supports decimal precision and tolerance.</p>
            </div>
            <div className={styles.questionCard}>
              <GitCompare size={20} className={styles.iconPrimary} />
              <h3>Assertion & Reason</h3>
              <p>Two statements where students must identify truth value and reasoning relationship.</p>
            </div>
            <div className={styles.questionCard}>
              <FileText size={20} className={styles.iconPrimary} />
              <h3>Comprehension/Passage</h3>
              <p>Multiple questions linked to a single reading passage or data set.</p>
            </div>
            <div className={styles.questionCard}>
              <BookOpen size={20} className={styles.iconPrimary} />
              <h3>Match the Following</h3>
              <p>Two columns of items that students must match correctly. Common in UPSC & NEET.</p>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Test Interface */}
        <TabsContent value="test-interface" className={styles.tabContent}>
          <div className={styles.twoColumnLayout}>
            <div className={styles.columnContent}>
              <h3 className={styles.columnTitle}>Exam-Like Testing Experience</h3>
              <p className={styles.columnSubtitle}>Give your students the exact feel of real computer-based tests.</p>
              
              <ul className={styles.featureList}>
                <li><Clock size={16} className={styles.iconPrimary} /> <span>Timed Tests</span></li>
                <li><List size={16} className={styles.iconPrimary} /> <span>Section-wise Navigation</span></li>
                <li><Palette size={16} className={styles.iconPrimary} /> <span>Question Palette Status</span></li>
                <li><Bookmark size={16} className={styles.iconPrimary} /> <span>Mark for Review</span></li>
                <li><Save size={16} className={styles.iconPrimary} /> <span>Auto-save Progress</span></li>
                <li><MinusCircle size={16} className={styles.iconPrimary} /> <span>Negative Marking</span></li>
                <li><PieChart size={16} className={styles.iconPrimary} /> <span>Partial Marking</span></li>
                <li><Calculator size={16} className={styles.iconPrimary} /> <span>Scientific Calculator</span></li>
                <li><Timer size={16} className={styles.iconPrimary} /> <span>Subject-wise Timer</span></li>
              </ul>
            </div>
            
            <div className={styles.columnVisual}>
              <div className={styles.browserMockup}>
                <div className={styles.browserHeader}>
                  <div className={styles.dot} style={{ background: 'var(--error)' }} />
                  <div className={styles.dot} style={{ background: 'var(--warning)' }} />
                  <div className={styles.dot} style={{ background: 'var(--success)' }} />
                </div>
                <div className={styles.browserContentTest}>
                  <div className={styles.testHeader}>
                    <div className={styles.timerMock}>12:45:00</div>
                  </div>
                  <div className={styles.testBody}>
                    <div className={styles.questionArea}>
                      <div className={styles.skeletonLine} style={{ width: '80%' }} />
                      <div className={styles.skeletonLine} style={{ width: '60%' }} />
                      <div className={styles.skeletonLine} style={{ width: '90%' }} />
                      <div className={styles.optionsMock}>
                        <div className={styles.optionMock} />
                        <div className={styles.optionMock} />
                        <div className={styles.optionMock} />
                        <div className={styles.optionMock} />
                      </div>
                    </div>
                    <div className={styles.paletteArea}>
                      {Array.from({ length: 12 }).map((_, i) => {
                        let status = 'unanswered';
                        if (i % 3 === 0) status = 'answered';
                        else if (i % 5 === 0) status = 'review';
                        return (
                          <div key={i} className={styles.paletteBox} data-status={status} />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Analytics */}
        <TabsContent value="analytics" className={styles.tabContent}>
          <div className={styles.twoColumnLayout}>
            <div className={styles.columnContent}>
              <h3 className={styles.columnTitle}>Best-in-Class Test Analytics</h3>
              <p className={styles.columnSubtitle}>Provide deep insights to help your students improve their performance.</p>
              
              <div className={styles.analyticsCardsGrid}>
                <div className={styles.analyticsMiniCard}>
                  <Trophy size={20} className={styles.iconPrimary} />
                  <div>
                    <h4>Score & Custom Grading</h4>
                    <p>Instantly display results with custom messages and insights.</p>
                  </div>
                </div>
                <div className={styles.analyticsMiniCard}>
                  <BarChart2 size={20} className={styles.iconPrimary} />
                  <div>
                    <h4>Attempt & Time Analysis</h4>
                    <p>Detailed breakdown of questions and time spent per question.</p>
                  </div>
                </div>
                <div className={styles.analyticsMiniCard}>
                  <Star size={20} className={styles.iconPrimary} />
                  <div>
                    <h4>Leaderboard & Percentile</h4>
                    <p>Foster healthy competition with live leaderboards and ranks.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={styles.columnVisual}>
              <div className={styles.browserMockup}>
                <div className={styles.browserHeader}>
                  <div className={styles.dot} style={{ background: 'var(--error)' }} />
                  <div className={styles.dot} style={{ background: 'var(--warning)' }} />
                  <div className={styles.dot} style={{ background: 'var(--success)' }} />
                </div>
                <div className={styles.browserContentAnalytics}>
                  <div className={styles.statsRow}>
                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>Score</span>
                      <span className={styles.statValue}>180/300</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>Percentile</span>
                      <span className={styles.statValue}>98.5</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>Accuracy</span>
                      <span className={styles.statValue}>85%</span>
                    </div>
                  </div>
                  <div className={styles.chartMock}>
                    <div className={styles.bar} style={{ height: '60%', background: 'var(--chart-color-1)' }} />
                    <div className={styles.bar} style={{ height: '80%', background: 'var(--chart-color-2)' }} />
                    <div className={styles.bar} style={{ height: '40%', background: 'var(--chart-color-3)' }} />
                    <div className={styles.bar} style={{ height: '90%', background: 'var(--chart-color-4)' }} />
                    <div className={styles.bar} style={{ height: '70%', background: 'var(--chart-color-5)' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Platform Tools */}
        <TabsContent value="platform-tools" className={styles.tabContent}>
          <div className={styles.platformGrid}>
            <div className={styles.platformItem}><Sparkles size={16} className={styles.iconPrimary} /> <span>AI Question Generation</span></div>
            <div className={styles.platformItem}><Upload size={16} className={styles.iconPrimary} /> <span>Bulk Upload via Excel</span></div>
            <div className={styles.platformItem}><Layers size={16} className={styles.iconPrimary} /> <span>Subject & Section Management</span></div>
            <div className={styles.platformItem}><Package size={16} className={styles.iconPrimary} /> <span>Test Series Bundles</span></div>
            <div className={styles.platformItem}><Tag size={16} className={styles.iconPrimary} /> <span>Promo Codes & Discounts</span></div>
            <div className={styles.platformItem}><Award size={16} className={styles.iconPrimary} /> <span>Student Certificates</span></div>
            <div className={styles.platformItem}><Heart size={16} className={styles.iconPrimary} /> <span>Student Sponsorship</span></div>
            <div className={styles.platformItem}><Layout size={16} className={styles.iconPrimary} /> <span>Teacher Academy Page</span></div>
            <div className={styles.platformItem}><ShieldCheck size={16} className={styles.iconPrimary} /> <span>Verified Teacher Badge</span></div>
            <div className={styles.platformItem}><BarChart size={16} className={styles.iconPrimary} /> <span>Earnings Dashboard</span></div>
            <div className={styles.platformItem}><DollarSign size={16} className={styles.iconPrimary} /> <span>Weekly Payouts</span></div>
            <div className={styles.platformItem}><Unlock size={16} className={styles.iconPrimary} /> <span>Free + Paid Tests</span></div>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
};