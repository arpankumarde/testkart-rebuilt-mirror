import React, { useState, useMemo } from 'react';
import { Selectable } from 'kysely';
import { ExamSubjects } from '../helpers/schema';
import { useExamSubjectsQuery, useDeleteExamSubjectMutation } from '../helpers/useAdminExamSubjects';
import { Button } from './Button';
import { Input } from './Input';
import { Badge } from './Badge';
import { Skeleton } from './Skeleton';
import { AlertTriangle, Plus, Search, Trash2, Edit, FolderOpen } from 'lucide-react';
import { SubjectFormDialog } from './SubjectFormDialog';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import styles from './ExamSubjectsManager.module.css';

interface ExamSubjectsManagerProps {
  examId: number;
  examName: string;
  className?: string;
}

export const ExamSubjectsManager: React.FC<ExamSubjectsManagerProps> = ({ examId, examName, className }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogState, setDialogState] = useState<{ open: boolean; subject?: Selectable<ExamSubjects> }>({ open: false });
  const [deleteDialogState, setDeleteDialogState] = useState<{ open: boolean; subject?: Selectable<ExamSubjects> }>({ open: false });

  const { data, isFetching, error } = useExamSubjectsQuery(examId);
  const deleteMutation = useDeleteExamSubjectMutation();

  const filteredSubjects = useMemo(() => {
    if (!data?.subjects) return [];
    return data.subjects.filter(subject =>
      subject.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subject.subjectSlug.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const handleDelete = () => {
    if (deleteDialogState.subject) {
      deleteMutation.mutate({ id: deleteDialogState.subject.id, examId });
      setDeleteDialogState({ open: false });
    }
  };

  const renderContent = () => {
    if (isFetching) {
      return Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className={styles.skeletonItem}>
          <Skeleton style={{ height: '2.5rem', width: '100%' }} />
        </div>
      ));
    }

    if (error) {
      return (
        <div className={styles.centeredMessage}>
          <AlertTriangle className={styles.errorIcon} />
          <p>Error loading subjects: {error.message}</p>
        </div>
      );
    }

    if (!filteredSubjects || filteredSubjects.length === 0) {
      return (
        <div className={styles.centeredMessage}>
          <FolderOpen className={styles.emptyIcon} />
          <p>No subjects found for this exam.</p>
          <p className={styles.emptySubtext}>
            {searchTerm ? 'Try adjusting your search.' : 'Click "Add Subject" to get started.'}
          </p>
        </div>
      );
    }

    return filteredSubjects.map(subject => (
      <div key={subject.id} className={styles.subjectContainer}>
        <div className={styles.subjectRow}>
          <div className={styles.subjectInfo}>
            <span className={styles.subjectName}>{subject.subjectName}</span>
            <span className={styles.subjectSlug}>/{subject.subjectSlug}</span>
          </div>
          <div className={styles.subjectMeta}>
            <Badge variant={subject.isActive ? 'success' : 'outline'}>
              {subject.isActive ? 'Active' : 'Inactive'}
            </Badge>
            <span className={styles.orderIndex}>Order: {subject.orderIndex}</span>
            <div className={styles.actions}>
              <Button variant="ghost" size="icon-sm" onClick={() => setDialogState({ open: true, subject })}>
                <Edit size={16} />
              </Button>
              <Button variant="ghost" size="icon-sm" className={styles.deleteButton} onClick={() => setDeleteDialogState({ open: true, subject })}>
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    ));
  };

  return (
    <div className={`${styles.managerContainer} ${className || ''}`}>
      <div className={styles.header}>
        <div className={styles.searchContainer}>
          <Search className={styles.searchIcon} size={18} />
          <Input
            placeholder="Search subjects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <Button onClick={() => setDialogState({ open: true })}>
          <Plus size={16} /> Add Subject
        </Button>
      </div>

      <div className={styles.listContainer}>
        {renderContent()}
      </div>

      <SubjectFormDialog
        isOpen={dialogState.open}
        onClose={() => setDialogState({ open: false })}
        examId={examId}
        subject={dialogState.subject}
      />

      <DeleteConfirmationDialog
        isOpen={deleteDialogState.open}
        onClose={() => setDeleteDialogState({ open: false })}
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
        itemName={deleteDialogState.subject?.subjectName}
        itemType="subject"
      />
    </div>
  );
};