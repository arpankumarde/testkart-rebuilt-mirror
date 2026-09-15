import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Globe,
  Award,
  ChevronRight,
  MapPin,
  Clock,
  Briefcase,
} from 'lucide-react';
import {
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaXTwitter,
  FaYoutube,
} from 'react-icons/fa6';
import { Avatar, AvatarImage, AvatarFallback } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';
import { slugify } from '../helpers/slugify';
import { TeacherPublicProfile } from '../helpers/teacherProfileTypes';
import { VerifiedBadge } from "./VerifiedBadge";
import styles from './TeacherProfileCard.module.css';

// Define the props for the component.
export interface TeacherProfileCardProps {
  teacher: TeacherPublicProfile;
  className?: string;
  variant?: 'default' | 'compact' | 'inline';
  hideViewAllButton?: boolean;
  hideViewProfileButton?: boolean;
}

// Helper to get initials from a name for the Avatar fallback.
const getInitials = (name: string) => {
  const names = name.split(' ');
  if (names.length === 1) {
    return names[0].substring(0, 2).toUpperCase();
  }
  return (names[0][0] + names[names.length - 1][0]).toUpperCase();
};

export const TeacherProfileCard = ({ teacher, className, variant = 'default', hideViewAllButton = false, hideViewProfileButton = false }: TeacherProfileCardProps) => {
    const {
    displayName,
    avatarUrl,
    bio,
    socialLinks,
    awardsCertificates,
    tagline,
    location,
    languages,
    responseTime,
    expertiseAreas,
  } = teacher;

  const BIO_TRUNCATE_LENGTH = 300;
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const shouldTruncateBio = bio && bio.length > BIO_TRUNCATE_LENGTH;

  const hasSocialLinks = socialLinks && Object.values(socialLinks).some(link => link && link.trim() !== '');
  const hasAwards = awardsCertificates && awardsCertificates.length > 0;
  const hasKeyInfo = (location && location.trim() !== '') || (languages && languages.length > 0) || (responseTime && responseTime.trim() !== '');
  const hasExpertise = expertiseAreas && expertiseAreas.length > 0;
  const hasWorkExperience = teacher.workExperiences && teacher.workExperiences.length > 0;

  const isCompact = variant === 'compact';
  const isInline = variant === 'inline';

  // Helper function to format work experience dates
  const formatWorkExperienceDate = (date: Date | null, isCurrent: boolean) => {
    if (isCurrent) return 'Present';
    if (!date) return '';
    return format(new Date(date), 'MMM yyyy');
  };

  // Get current position
  const currentPosition = teacher.workExperiences?.find(exp => exp.isCurrent);

  // Inline variant
  if (isInline) {
    return (
      <div className={`${styles.inline} ${className || ''}`}>
        <Avatar className={styles.avatarInline}>
          <AvatarImage src={avatarUrl || undefined} alt={`${displayName}'s avatar`} />
          <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
        </Avatar>
        <div className={styles.inlineInfo}>
          <div className={styles.inlineNameRow}>
            <span className={styles.nameInline}>{displayName}</span>
            <VerifiedBadge isVerified={!!teacher.isVerified} size="sm" />
          </div>
          {tagline && tagline.trim() !== '' && (
            <span className={styles.taglineInline}>{tagline}</span>
          )}
        </div>
        <Link to={`/expert/${teacher.slug || slugify(displayName)}`} className={styles.inlineLink}>
          View Profile <ChevronRight size={14} className={styles.inlineLinkIcon} />
        </Link>
      </div>
    );
  }

  // Compact variant
  if (isCompact) {
    return (
      <div className={`${styles.card} ${styles.compact} ${className || ''}`}>
        <div className={styles.compactContent}>
          <Avatar className={styles.avatarCompact}>
            <AvatarImage src={avatarUrl || undefined} alt={`${displayName}'s avatar`} />
            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
          </Avatar>
          <div className={styles.compactInfo}>
            <h3 className={styles.nameCompact}>{displayName} <VerifiedBadge isVerified={!!teacher.isVerified} size="sm" /></h3>
            {currentPosition && (
              <p className={styles.currentPositionCompact}>
                {currentPosition.position} at {currentPosition.companyName}
              </p>
            )}
            {bio && <p className={styles.bioCompact}>{bio}</p>}
          </div>
          <Link to={`/expert/${teacher.slug || slugify(displayName)}`} className={styles.viewProfileButton}>
            View Profile
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

    // Default variant
  return (
    <div className={`${styles.card} ${className || ''}`}>
      {/* Header Section */}
      <div className={styles.header}>
        <div className={styles.avatarLarge}>
          {avatarUrl ? (
            <img
              className={styles.avatarImage}
              src={avatarUrl || undefined}
              alt={`${displayName}'s avatar`}
            />
          ) : (
            <div className={styles.avatarFallback}>{getInitials(displayName)}</div>
          )}
        </div>
        
        <div className={styles.headerContent}>
          <div className={styles.headerTop}>
            <h2 className={styles.name}>{displayName} <VerifiedBadge isVerified={!!teacher.isVerified} size="md" /></h2>
            {/* Optional: Add a "Top Mentor" badge here if we have that data in the future */}
          </div>

          {currentPosition && (
            <p className={styles.headerPosition}>
              {currentPosition.position} at {currentPosition.companyName}
            </p>
          )}
          
          {tagline && tagline.trim() !== '' && <p className={styles.tagline}>{tagline}</p>}

          <div className={styles.metaInfoStack}>
            {hasExpertise && (
              <div className={styles.metaInfoRow}>
                <span className={styles.metaLabel}>Expertise:</span>
                <div className={styles.expertiseBadges}>
                  {expertiseAreas!.map((area, index) => (
                    <Badge key={index} variant="secondary">
                      {typeof area === 'string' ? area : area.examName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {languages && languages.length > 0 && (
              <div className={styles.metaInfoRow}>
                <span className={styles.metaLabel}>Speaks:</span>
                <span className={styles.metaValue}>
                  <Globe size={14} className={styles.metaIcon} />
                  {languages.join(', ')}
                </span>
              </div>
            )}
            
            {location && location.trim() !== '' && (
              <div className={styles.metaInfoRow}>
                <span className={styles.metaLabel}>Location:</span>
                <span className={styles.metaValue}>
                  <MapPin size={14} className={styles.metaIcon} />
                  {location}
                </span>
              </div>
            )}

            {responseTime && responseTime.trim() !== '' && (
              <div className={styles.metaInfoRow}>
                <span className={styles.metaLabel}>Response time:</span>
                <span className={styles.metaValue}>
                  <Clock size={14} className={styles.metaIcon} />
                  {responseTime}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Work Experience Section */}
      {hasWorkExperience && (
        <div className={styles.workExperienceSection}>
          <h3 className={styles.sectionTitle}>
            <Briefcase size={18} />
            Work Experience
          </h3>
          <div className={styles.workExperienceScroll}>
            {teacher.workExperiences!.slice(0, 3).map((experience) => (
              <div key={experience.id} className={styles.workExperienceCard}>
                <h4 className={styles.workExperiencePosition}>{experience.position}</h4>
                <p className={styles.workExperienceCompany}>
                  {experience.companyName}
                  {experience.location && ` • ${experience.location}`}
                </p>
                <p className={styles.workExperienceDates}>
                  {formatWorkExperienceDate(experience.startDate, false)} - {formatWorkExperienceDate(experience.endDate, experience.isCurrent)}
                </p>
                {experience.description && (
                  <p className={styles.workExperienceDescription}>
                    {experience.description.length > 150 
                      ? experience.description.slice(0, 150).trim() + '...'
                      : experience.description}
                  </p>
                )}
              </div>
            ))}
          </div>
          {teacher.workExperiences!.length > 3 && (
            <p className={styles.moreIndicator}>
              +{teacher.workExperiences!.length - 3} more
            </p>
          )}
        </div>
      )}

      {/* About Section */}
      {bio && bio.trim() !== '' && (
        <div className={styles.aboutSection}>
          <h3 className={styles.sectionTitle}>About</h3>
          <p className={styles.bioText}>
            {shouldTruncateBio && !isBioExpanded 
              ? bio.slice(0, BIO_TRUNCATE_LENGTH).trim() + '... '
              : bio + ' '}
            {shouldTruncateBio && (
              <button
                onClick={() => setIsBioExpanded(!isBioExpanded)}
                className={styles.bioToggle}
                type="button"
              >
                {isBioExpanded ? 'Show Less' : 'Show More'}
              </button>
            )}
          </p>
        </div>
      )}

      {/* Social Section */}
      {hasSocialLinks && (
        <div className={styles.contactSection}>
          <h3 className={styles.sectionTitle}>Social</h3>
          <div className={styles.socialLinks}>
                {socialLinks?.facebook && (
                  <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={styles.socialLink}>
                    <FaFacebook size={20} />
                  </a>
                )}
                {socialLinks?.twitter && (
                  <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className={styles.socialLink}>
                    <FaXTwitter size={20} />
                  </a>
                )}
                {socialLinks?.linkedin && (
                  <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className={styles.socialLink}>
                    <FaLinkedin size={20} />
                  </a>
                )}
                {socialLinks?.instagram && (
                  <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={styles.socialLink}>
                    <FaInstagram size={20} />
                  </a>
                )}
                {socialLinks?.youtube && (
                  <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className={styles.socialLink}>
                    <FaYoutube size={20} />
                  </a>
                )}
          </div>
        </div>
      )}

      {/* View Profile Action for Default Variant */}
      {!hideViewProfileButton && (
        <div className={styles.footerAction}>
          <Button asChild variant="outline" className={styles.fullWidthButton}>
            <Link to={`/expert/${teacher.slug || slugify(displayName)}`}>
              View Full Profile
              <ChevronRight size={16} />
            </Link>
          </Button>
        </div>
      )}

      {/* Awards Section */}
      {hasAwards && (
        <div className={styles.awardsSection}>
          <h3 className={styles.sectionTitle}>
            <Award size={18} />
            Awards & Certificates
          </h3>
          <div className={styles.awardsScroll}>
            {awardsCertificates.map((award, index) => (
              <div key={index} className={styles.awardCard}>
                <div className={styles.awardCardIcon}>
                  <Award size={18} />
                </div>
                <h4 className={styles.awardCardTitle}>{award.title}</h4>
                {award.description && (
                  <p className={styles.awardCardDescription}>{award.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};