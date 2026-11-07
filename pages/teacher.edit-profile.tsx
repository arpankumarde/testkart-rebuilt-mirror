import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Award,
  Briefcase,
  Check,
  Circle,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Languages,
  Link2,
  MapPin,
  NotebookPen,
  Pencil,
  Target,
  UserRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useForm, Form } from '../components/Form';
import { useAuth } from '../helpers/useAuth';
import type { User } from '../helpers/User';
import { useTeacherProfileMutations } from '../helpers/useTeacherProfileMutations';
import { useTeacherPublicProfileQuery } from '../helpers/useTeacherPublicProfile';
import { teacherProfileFormSchema, TeacherProfileFormValues } from '../helpers/teacherProfileFormSchema';
import { teacherProfileCompleteness, type TeacherProfileField } from '../helpers/teacherProfileCompleteness';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { ToggleGroup, ToggleGroupItem } from '../components/ToggleGroup';
import { EditProfileIdentitySection } from '../components/EditProfileIdentitySection';
import { EditProfileAboutSection } from '../components/EditProfileAboutSection';
import { EditProfileSocialSection } from '../components/EditProfileSocialSection';
import { EditProfileAwardsSection } from '../components/EditProfileAwardsSection';
import { EditProfileWorkExperienceSection } from '../components/EditProfileWorkExperienceSection';
import { ExamFocusSection } from '../components/ExamFocusSection';
import { ExpertProfileView } from '../components/ExpertProfileView';
import styles from './teacher.edit-profile.module.css';

type PanelId = 'photo' | 'about' | 'links' | 'awards' | 'experience' | 'exams';

// The panel holding each form field, for jumping to a failed or missing field.
const FIELD_PANEL: Record<string, PanelId> = {
  avatarUrl: 'photo',
  avatarFileId: 'photo',
  displayName: 'photo',
  academyName: 'photo',
  tagline: 'photo',
  bio: 'about',
  expertiseAreas: 'about',
  languages: 'about',
  location: 'about',
  slug: 'links',
  websiteUrl: 'links',
  socialLinks: 'links',
  awardsCertificates: 'awards',
};

const CHECK_PANEL: Record<TeacherProfileField, PanelId> = {
  avatarUrl: 'photo',
  displayName: 'photo',
  tagline: 'photo',
  bio: 'about',
  location: 'about',
  languages: 'about',
  expertiseAreas: 'about',
  slug: 'links',
  socialLinks: 'links',
  awardsCertificates: 'awards',
};

// Older rows stored expertise as { examName } objects.
const expertiseOf = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((area) => (typeof area === 'string' ? area : (area as { examName?: string })?.examName ?? ''))
    .filter(Boolean);
};

const toFormValues = (user: User): TeacherProfileFormValues => ({
  displayName: user.displayName || '',
  academyName: user.academyName || '',
  slug: user.slug || '',
  avatarUrl: user.avatarUrl || '',
  avatarFileId: user.avatarFileId || null,
  bio: user.bio || '',
  tagline: user.tagline || '',
  location: user.location || '',
  languages: user.languages || [],
  responseTime: user.responseTime || '',
  expertiseAreas: expertiseOf(user.expertiseAreas),
  publicEmail: user.publicEmail || '',
  publicPhone: user.publicPhone || '',
  websiteUrl: user.websiteUrl || '',
  socialLinks: {
    facebook: user.socialLinks?.facebook || '',
    twitter: user.socialLinks?.twitter || '',
    linkedin: user.socialLinks?.linkedin || '',
    instagram: user.socialLinks?.instagram || '',
    youtube: user.socialLinks?.youtube || '',
  },
  awardsCertificates: (user.awardsCertificates || []).map((award) => ({
    title: award.title ?? '',
    description: award.description ?? '',
  })),
});

// A stable string of the editable values, so unsaved changes can be detected.
const snapshot = (v: TeacherProfileFormValues) =>
  JSON.stringify([
    v.displayName, v.academyName ?? '', v.slug, v.avatarUrl ?? '', v.bio ?? '', v.tagline ?? '',
    v.location ?? '', v.languages ?? [], v.expertiseAreas ?? [], v.websiteUrl ?? '',
    v.socialLinks?.facebook ?? '', v.socialLinks?.twitter ?? '', v.socialLinks?.linkedin ?? '',
    v.socialLinks?.instagram ?? '', v.socialLinks?.youtube ?? '',
    (v.awardsCertificates ?? []).map((a) => [a.title, a.description ?? '']),
  ]);

const EMPTY_VALUES: TeacherProfileFormValues = {
  displayName: '',
  academyName: '',
  slug: '',
  avatarUrl: '',
  avatarFileId: null,
  bio: '',
  tagline: '',
  location: '',
  languages: [],
  responseTime: '',
  expertiseAreas: [],
  publicEmail: '',
  publicPhone: '',
  websiteUrl: '',
  socialLinks: { facebook: '', twitter: '', linkedin: '', instagram: '', youtube: '' },
  awardsCertificates: [],
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scrollToPanel = (id: PanelId) => {
  document.getElementById(id)?.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  });
};

const EditProfilePage: React.FC = () => {
  const { authState } = useAuth();
  const { useUpdateProfileMutation } = useTeacherProfileMutations();
  const updateProfile = useUpdateProfileMutation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(true);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  const isOnboarding = searchParams.get('onboarding') === 'true';
  const user = authState.type === 'authenticated' ? authState.user : null;

  const form = useForm({ schema: teacherProfileFormSchema, defaultValues: EMPTY_VALUES });

  const saved = useMemo(() => (user ? toFormValues(user) : null), [user]);
  const savedKey = saved ? snapshot(saved) : null;
  const currentKey = snapshot(form.values);
  const isDirty = savedKey !== null && currentKey !== savedKey;

  // Loads the saved profile, and reloads it when the account changes underneath
  // (another tab, a save) - but never over edits the teacher has not saved.
  const loadedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!saved || savedKey === null) return;
    if (loadedKey.current === null || loadedKey.current === currentKey) {
      form.setValues(saved);
    }
    loadedKey.current = savedKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const slug = user?.slug ?? null;
  const publicUrl = slug ? `https://testkart.in/expert/${slug}` : null;
  const completeness = useMemo(() => teacherProfileCompleteness(form.values), [form.values]);

  const onSubmit = async (values: TeacherProfileFormValues) => {
    try {
      const saving = updateProfile.mutateAsync(values);
      toast.promise(saving, {
        loading: 'Saving your profile...',
        success: 'Profile saved. It is live now.',
        error: (err) => (err instanceof Error ? err.message : 'Could not save your profile.'),
      });
      const updated = await saving;

      // The server normalises some fields (a website gains https://), so the
      // form takes the saved copy and the page reads as clean.
      if (user) {
        const next = toFormValues({ ...user, ...updated });
        loadedKey.current = snapshot(next);
        form.setValues(next);
      }

      // The preview reads the published profile, so its cache goes stale here.
      const savedSlug = values.slug || slug;
      if (savedSlug) {
        await queryClient.invalidateQueries({ queryKey: ['teacherProfile', savedSlug] });
      }

      if (isOnboarding) {
        navigate('/teacher/dashboard');
      }
    } catch (error) {
      console.error('Profile update error:', error);
    }
  };

  const handleSave = () => {
    if (form.validateForm()) {
      void onSubmit(form.values);
      return;
    }
    const result = teacherProfileFormSchema.safeParse(form.values);
    const firstPath = result.success ? undefined : result.error.errors[0]?.path[0];
    const target = typeof firstPath === 'string' ? FIELD_PANEL[firstPath] : undefined;
    if (target) scrollToPanel(target);
    toast.error('Some details need fixing before this can be saved.');
  };

  const handleDiscard = () => {
    if (saved) form.setValues(saved);
  };

  const handleValuesChange = (newValues: Partial<TeacherProfileFormValues>) => {
    form.setValues((prev) => ({ ...prev, ...newValues }));
  };

  const handleCopyUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Profile link copied.');
    } catch {
      toast.error('Could not copy the link.');
    }
  };

  if (authState.type === 'loading') {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton style={{ height: '2rem', width: '14rem' }} />
        <div className={styles.layout}>
          <Skeleton style={{ height: '30rem', width: '100%', borderRadius: 'var(--radius-md)' }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isOwner = user.teacherRole !== 'manager';

  return (
    <>
      <Helmet>
        <title>Your profile - Testkart for Teachers</title>
        <meta name="description" content="Edit the public profile students see, and preview it before it goes live." />
      </Helmet>

      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.eyebrow}>Public profile</span>
            <h1 className={styles.title}>
              Your profile
              <svg className={styles.underline} viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2 6.5C20 2.5 38 8.5 58 5S98 2 118 5.5" />
              </svg>
            </h1>
            <p className={styles.subtitle}>
              {publicUrl ? (
                <>
                  Students see this at{' '}
                  <Link to={`/expert/${slug}`} target="_blank" rel="noopener noreferrer" className={styles.urlChip}>
                    testkart.in/expert/{slug}
                    <ExternalLink size={13} aria-hidden="true" />
                  </Link>
                </>
              ) : (
                'Choose a profile address under Links to publish your page.'
              )}
            </p>
          </div>

          <div className={styles.headerActions}>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(next) => next && setMode(next as 'edit' | 'preview')}
              size="sm"
              variant="outline"
              aria-label="Profile mode"
              className={styles.modeToggle}
            >
              <ToggleGroupItem value="edit" aria-label="Edit profile">
                <Pencil size={15} />
                Edit
              </ToggleGroupItem>
              <ToggleGroupItem value="preview" aria-label="Preview public page">
                <Eye size={15} />
                Preview
              </ToggleGroupItem>
            </ToggleGroup>

            {slug && (
              <Button variant="outline" size="sm" onClick={handleCopyUrl} className={styles.pillButton}>
                <Copy size={15} />
                Copy link
              </Button>
            )}
          </div>
        </header>

        {isOnboarding && showOnboardingBanner && (
          <div className={styles.onboardingBanner}>
            <div className={styles.onboardingBannerText}>
              <h2 className={styles.onboardingBannerTitle}>Welcome to Testkart</h2>
              <p className={styles.onboardingBannerDescription}>
                Set up your profile before you publish anything. A photo, your name and a few lines
                about you are what convince a student to buy.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowOnboardingBanner(false)}
              className={styles.onboardingBannerClose}
              aria-label="Dismiss"
            >
              <X size={16} />
            </Button>
          </div>
        )}

        {mode === 'edit' ? (
          <div className={styles.layout}>
            <div className={styles.main}>
              <Form {...form}>
                <form
                  className={styles.form}
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSave();
                  }}
                >
                  <Panel id="photo" title="Photo and name" description="The first thing students see on your page and beside every test you sell.">
                    <EditProfileIdentitySection
                      formValues={form.values}
                      onValuesChange={handleValuesChange}
                      isOnboarding={isOnboarding}
                      isVerified={user.isVerified || false}
                    />
                  </Panel>

                  <Panel id="about" title="About you" description="Why a student should learn from you.">
                    <EditProfileAboutSection
                      formValues={form.values}
                      onValuesChange={handleValuesChange}
                      isOnboarding={isOnboarding}
                    />
                  </Panel>

                  <Panel id="links" title="Links" description="Your page address and where else students can find you.">
                    <EditProfileSocialSection
                      formValues={form.values}
                      onValuesChange={handleValuesChange}
                      savedSlug={slug}
                    />
                  </Panel>

                  <Panel id="awards" title="Awards and certificates" description="Proof of your record, listed on your page.">
                    <EditProfileAwardsSection formValues={form.values} onValuesChange={handleValuesChange} />
                  </Panel>

                  <div className={`${styles.saveBar} ${isDirty ? styles.saveBarDirty : ''}`} role="region" aria-label="Save profile">
                    <span className={styles.saveStatus} aria-live="polite">
                      {isDirty ? (
                        <>
                          <span className={styles.dirtyDot} aria-hidden="true" />
                          You have unsaved changes
                        </>
                      ) : (
                        <>
                          <Check size={16} className={styles.savedIcon} aria-hidden="true" />
                          All changes saved
                        </>
                      )}
                    </span>
                    <div className={styles.saveActions}>
                      {isDirty && (
                        <Button type="button" variant="ghost" onClick={handleDiscard} disabled={updateProfile.isPending}>
                          Discard
                        </Button>
                      )}
                      <Button type="submit" className={styles.saveButton} disabled={!isDirty || updateProfile.isPending}>
                        {updateProfile.isPending ? 'Saving...' : 'Save changes'}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>

              <p className={styles.groupNote}>These save on their own, one entry at a time.</p>

              <Panel id="experience" title="Work experience" description="Schools, institutes and platforms you have taught at.">
                <EditProfileWorkExperienceSection />
              </Panel>

              {isOwner && (
                <Panel
                  id="exams"
                  title="Exam focus"
                  description="The exams you prepare students for, up to 5. Private - it is not shown on your page."
                >
                  <ExamFocusSection className={styles.examFocus} />
                </Panel>
              )}
            </div>

            <aside className={styles.aside} aria-label="Profile summary">
              <LiveCard values={form.values} isVerified={!!user.isVerified} />

              <section className={styles.strength} aria-labelledby="profile-strength-title">
                <div className={styles.strengthHead}>
                  <h2 id="profile-strength-title" className={styles.strengthTitle}>Profile strength</h2>
                  <span className={styles.strengthValue}>{completeness.percent}%</span>
                </div>
                <div
                  className={styles.strengthTrack}
                  role="progressbar"
                  aria-valuenow={completeness.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Profile strength"
                >
                  <span className={styles.strengthBar} style={{ width: `${completeness.percent}%` }} />
                </div>
                <ul className={styles.checks} role="list">
                  {completeness.checks.map((check) => (
                    <li key={check.field}>
                      <button
                        type="button"
                        className={`${styles.check} ${check.done ? styles.checkDone : ''}`}
                        onClick={() => scrollToPanel(CHECK_PANEL[check.field])}
                      >
                        {check.done ? (
                          <span className={styles.checkTick} aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
                        ) : (
                          <Circle size={16} className={styles.checkOpen} aria-hidden="true" />
                        )}
                        <span>{check.label}</span>
                        <span className={styles.srOnly}>{check.done ? '(done)' : '(to do)'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className={styles.strengthNext}>
                  {completeness.next
                    ? `${completeness.done} of ${completeness.total} done. Next: ${completeness.next.label.toLowerCase()}.`
                    : 'Every item is done. Your page is ready to share.'}
                </p>
              </section>
            </aside>
          </div>
        ) : (
          <ProfilePreview slug={slug} hasUnsaved={isDirty} onGoToLinks={() => { setMode('edit'); window.requestAnimationFrame(() => scrollToPanel('links')); }} />
        )}
      </div>
    </>
  );
};

// Each section gets its own pastel tile, as the /app cards do.
const PANEL_ICON: Record<PanelId, { Icon: LucideIcon; tone: string }> = {
  photo: { Icon: UserRound, tone: styles.tonePeach },
  about: { Icon: NotebookPen, tone: styles.toneLavender },
  links: { Icon: Link2, tone: styles.toneBlue },
  awards: { Icon: Award, tone: styles.toneButter },
  experience: { Icon: Briefcase, tone: styles.toneSage },
  exams: { Icon: Target, tone: styles.toneMint },
};

const Panel: React.FC<{ id: PanelId; title: string; description?: string; children: React.ReactNode }> = ({
  id,
  title,
  description,
  children,
}) => {
  const { Icon, tone } = PANEL_ICON[id];
  return (
    <section id={id} className={styles.panel} aria-labelledby={`${id}-title`}>
      <div className={styles.panelHead}>
        <span className={`${styles.panelIcon} ${tone}`} aria-hidden="true">
          <Icon size={18} />
        </span>
        <div className={styles.panelHeadText}>
          <h2 id={`${id}-title`} className={styles.panelTitle}>{title}</h2>
          {description && <p className={styles.panelDescription}>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
};

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();

// How the top of the public page reads, from the unsaved form.
const LiveCard: React.FC<{ values: TeacherProfileFormValues; isVerified: boolean }> = ({ values, isVerified }) => {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [values.avatarUrl]);

  const name = values.displayName.trim() || 'Your name';
  const languages = values.languages ?? [];
  const subjects = values.expertiseAreas ?? [];

  return (
    <section className={styles.card} aria-labelledby="live-card-title">
      <p id="live-card-title" className={styles.cardEyebrow}>How students see you</p>
      <div className={styles.cardTop}>
        <span className={styles.cardAvatar} aria-hidden="true">
          {values.avatarUrl && !imageFailed ? (
            <img src={values.avatarUrl} alt="" onError={() => setImageFailed(true)} />
          ) : (
            initialsOf(values.displayName) || <UserRound size={28} />

          )}
        </span>
        <div className={styles.cardIdentity}>
          <p className={styles.cardName}>
            <span>{name}</span>
            {isVerified && <VerifiedBadge isVerified size="xs" />}
          </p>
          {values.academyName?.trim() && <p className={styles.cardAcademy}>{values.academyName.trim()}</p>}
        </div>
      </div>

      <p className={values.tagline?.trim() ? styles.cardTagline : styles.cardPlaceholder}>
        {values.tagline?.trim() || 'Your tagline appears here.'}
      </p>

      {(values.location?.trim() || languages.length > 0) && (
        <ul className={styles.cardMeta} role="list">
          {values.location?.trim() && (
            <li><MapPin size={14} aria-hidden="true" />{values.location.trim()}</li>
          )}
          {languages.length > 0 && (
            <li><Languages size={14} aria-hidden="true" />{languages.join(', ')}</li>
          )}
        </ul>
      )}

      {subjects.length > 0 && (
        <ul className={styles.cardChips} role="list" aria-label="Subjects and exams">
          {subjects.slice(0, 5).map((subject) => <li key={subject}>{subject}</li>)}
          {subjects.length > 5 && <li className={styles.cardChipMore}>+{subjects.length - 5}</li>}
        </ul>
      )}
    </section>
  );
};

const ProfilePreview: React.FC<{ slug: string | null; hasUnsaved: boolean; onGoToLinks: () => void }> = ({
  slug,
  hasUnsaved,
  onGoToLinks,
}) => {
  const { data, isLoading, isError, error, refetch } = useTeacherPublicProfileQuery(slug ?? '');

  // Entering the preview always re-reads the published profile, so it never
  // shows a copy cached from before the last save.
  useEffect(() => {
    if (slug) void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (!slug) {
    return (
      <div className={styles.previewEmpty}>
        <h2 className={styles.previewEmptyTitle}>Your page does not have an address yet</h2>
        <p className={styles.previewEmptyText}>
          Choose a profile address under Links and save. Your page goes live there straight away.
        </p>
        <Button onClick={onGoToLinks}>Choose an address</Button>
      </div>
    );
  }

  return (
    <div className={styles.previewWrap}>
      <div className={styles.previewBar}>
        <span className={styles.previewUrl}>
          <Globe size={14} aria-hidden="true" />
          testkart.in/expert/{slug}
        </span>
        <span className={hasUnsaved ? styles.previewNoteUnsaved : styles.previewNote}>
          {hasUnsaved ? 'Showing your saved profile - unsaved edits are not shown' : 'Showing your saved profile'}
        </span>
        <Button asChild variant="outline" size="sm" className={styles.pillButton}>
          <Link to={`/expert/${slug}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} />
            Open live page
          </Link>
        </Button>
      </div>

      <div className={styles.previewViewport}>
        {isLoading ? (
          <div className={styles.previewLoading} aria-busy="true">
            <Skeleton style={{ height: '16rem', width: '100%' }} />
            <Skeleton style={{ height: '6rem', width: '100%' }} />
            <Skeleton style={{ height: '14rem', width: '100%' }} />
          </div>
        ) : isError || !data ? (
          <div className={styles.previewEmpty}>
            <h2 className={styles.previewEmptyTitle}>The public page could not be loaded</h2>
            <p className={styles.previewEmptyText}>
              {error instanceof Error ? error.message : 'Try again in a moment.'}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <ExpertProfileView data={data} variant="preview" />
        )}
      </div>
    </div>
  );
};

export default EditProfilePage;
