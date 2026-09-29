import React from 'react';
import type { ContentType } from '../helpers/schema';
import { useContentRejection } from '../helpers/useContentRejection';
import { TeacherRejectionNote } from './TeacherRejectionNote';

interface TeacherRejectionBannerProps {
  contentType: ContentType;
  contentId: number | null | undefined;
  className?: string;
}

/* The rejection reason at the top of a teacher editor; renders nothing unless the item is rejected. */
export const TeacherRejectionBanner: React.FC<TeacherRejectionBannerProps> = ({ contentType, contentId, className }) => {
  const rejection = useContentRejection(contentType, contentId);
  if (!rejection) return null;
  return <TeacherRejectionNote rejection={rejection} size="large" className={className} />;
};