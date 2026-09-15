import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Calendar } from 'lucide-react';
import { Badge } from './Badge';
import { Avatar, AvatarFallback, AvatarImage } from './Avatar';
import { PublicPostListItem } from '../endpoints/blog/list_GET.schema';
import styles from './BlogPostCard.module.css';

const formatDate = (date: string | Date) => {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
};

export const BlogPostCard = ({ post, prefix = "/blog" }: { post: PublicPostListItem, prefix?: string }) => {
  return (
    <Link to={`${prefix}/${post.slug}`} className={styles.card}>
      <div className={styles.content}>
        {post.categoryName && (
          <Badge className={styles.badge}>{post.categoryName}</Badge>
        )}
        <h3 className={styles.title}>{post.title}</h3>
        <p className={styles.excerpt}>{post.excerpt || 'Read more about this topic...'}</p>
        <div className={styles.footer}>
          <div className={styles.author}>
            <Avatar className={styles.avatar}>
              <AvatarImage src={post.authorAvatar || undefined} />
              <AvatarFallback>{post.authorName?.[0] || 'T'}</AvatarFallback>
            </Avatar>
            <span className={styles.authorName}>{post.authorName || 'Testkart Team'}</span>
          </div>
          <div className={styles.meta}>
            <span className={styles.metaItem}><Clock size={14} /> {post.readingTimeMinutes} min</span>
            {post.publishedAt && (
              <span className={styles.metaItem}><Calendar size={14} /> {formatDate(post.publishedAt)}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};