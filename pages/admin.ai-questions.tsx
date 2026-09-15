import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { useDebounce } from "use-debounce";

import { AIQuestionsStats } from "../components/AIQuestionsStats";
import { AIQuestionsFilters } from "../components/AIQuestionsFilters";
import { AIQuestionsTable } from "../components/AIQuestionsTable";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { useAdminExamsQuery } from "../helpers/useAdminExamCategories";
import { useAIQuestionsList, useAIQuestionsStats } from "../helpers/useAdminAIQuestions";

import styles from "./admin.ai-questions.module.css";

const AdminAIQuestionsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Filters State
  const filters = {
    page: parseInt(searchParams.get("page") || "1", 10),
    searchQuery: searchParams.get("searchQuery") || "",
    examId: searchParams.get("examId") ? parseInt(searchParams.get("examId")!, 10) : undefined,
    markedForReview: searchParams.get("markedForReview") === 'true' ? true : searchParams.get("markedForReview") === 'false' ? false : undefined,
    hasCustomPrompt: searchParams.get("hasCustomPrompt") === 'true' ? true : searchParams.get("hasCustomPrompt") === 'false' ? false : undefined,
    dateFrom: searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : undefined,
    dateTo: searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : undefined,
  };

  const [debouncedSearchQuery] = useDebounce(filters.searchQuery, 500);

  const queryParams = useMemo(() => ({
    ...filters,
    searchQuery: debouncedSearchQuery,
    page: filters.page,
    pageSize: 20,
  }), [filters, debouncedSearchQuery]);

  const { data, isFetching, error } = useAIQuestionsList(queryParams);
  const { data: stats, isFetching: isStatsFetching } = useAIQuestionsStats();
  const { data: examsData } = useAdminExamsQuery();

  const handleFilterChange = (key: string, value: string | number | boolean | Date | undefined | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === undefined || value === null || value === '') {
      newParams.delete(key);
    } else if (value instanceof Date) {
      newParams.set(key, value.toISOString().split('T')[0]);
    } else {
      newParams.set(key, String(value));
    }
    if (key !== 'page') {
        newParams.set('page', '1');
    }
    setSearchParams(newParams);
    setSelectedIds([]);
  };

  const clearFilters = () => {
    setSearchParams({ page: '1' });
    setSelectedIds([]);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.questions) {
      setSelectedIds(data.questions.map(q => q.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  const handlePageChange = (page: number) => {
    handleFilterChange('page', page);
  };

  return (
    <div className={styles.page}>
      <Helmet>
        <title>AI questions - Testkart Admin</title>
      </Helmet>
      <ConsolePageHeader title="AI questions" />

      <AIQuestionsStats stats={stats} isLoading={isStatsFetching} />

      <div className={styles.contentCard}>
        <AIQuestionsFilters 
          filters={filters}
          exams={examsData?.exams}
          onFilterChange={handleFilterChange}
          onClearFilters={clearFilters}
        />
        <AIQuestionsTable
          questions={data?.questions}
          isFetching={isFetching}
          error={error}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectOne={handleSelectOne}
          pagination={data?.pagination}
          currentPage={filters.page}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
};

export default AdminAIQuestionsPage;