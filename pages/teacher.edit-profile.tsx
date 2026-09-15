import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Award,
  Briefcase,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Info,
  Pencil,
  UserCircle,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useForm, Form } from '../components/Form';
import { useAuth } from '../helpers/useAuth';
import { useTeacherProfileMutations } from '../helpers/useTeacherProfileMutations';
import { useTeacherPublicProfileQuery } from '../helpers/useTeacherPublicProfile';
import { teacherProfileFormSchema, TeacherProfileFormValues } from '../helpers/teacherProfileFormSchema';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { ToggleGroup, ToggleGroupItem } from '../components/ToggleGroup';
import { EditProfileIdentitySection } from '../components/EditProfileIdentitySection';
import { EditProfileWorkExperienceSection } from '../components/EditProfileWorkExperienceSection';
import { EditProfileSocialSection } from '../components/EditProfileSocialSection';
import { EditProfileAwardsSection } from '../components/EditProfileAwardsSection';
import { ExpertProfileView } from '../components/ExpertProfileView';
import styles from './teacher.edit-profile.module.css';

type SectionKey = 'basics' | 'details' | 'experience' | 'credentials';

const SECTIONS: { key: SectionKey; label: string; hint: string; icon: LucideIcon }[] = [
  { key: 'basics', label: 'Basic information', hint: 'Photo, name, URL, about', icon: UserCircle },
  { key: 'details', label: 'Details & links', hint: 'Location, languages, socials', icon: Globe },
  { key: 'experience', label: 'Work experience', hint: 'Where you have taught', icon: Briefcase },
  { key: 'credentials', label: 'Awards & certificates', hint: 'Proof of your record', icon: Award },
];

// Work experience saves itself, row by row, through its own endpoints.
const FORM_SECTIONS: SectionKey[] = ['basics', 'details', 'credentials'];

// Which panel a failed field belongs to, so a validation error switches to the
// section holding it instead of silently rejecting the save.
const FIELD_SECTION: Record<string, SectionKey> = {
  displayName: 'basics',
  slug: 'basics',
  avatarUrl: 'basics',
  avatarFileId: 'basics',
  tagline: 'basics',
  bio: 'basics',
  websiteUrl: 'details',
  location: 'details',
  languages: 'details',
  responseTime: 'details',
  expertiseAreas: 'details',
  publicEmail: 'details',
  publicPhone: 'details',
  socialLinks: 'details',
  awardsCertificates: 'credentials',
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
  const [section, setSection] = useState<SectionKey>('basics');

  const isOnboarding = searchParams.get('onboarding') === 'true';

  const form = useForm({
    schema: teacherProfileFormSchema,
    defaultValues: {
      displayName: '',
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
      socialLinks: {
        facebook: '',
        twitter: '',
        linkedin: '',
        instagram: '',
        youtube: '',
      },
      awardsCertificates: [],
    },
  });

  useEffect(() => {
    if (authState.type === 'authenticated') {
      // Migrate old expertiseAreas format to new format
      let migratedExpertiseAreas: string[] = [];
      if (authState.user.expertiseAreas) {
        if (typeof authState.user.expertiseAreas[0] === 'string') {
          // Already in new format
          migratedExpertiseAreas = authState.user.expertiseAreas as string[];
        } else if (typeof authState.user.expertiseAreas[0] === 'object') {
          // Old format - extract examName from each object
          migratedExpertiseAreas = (authState.user.expertiseAreas as any[]).map((area: any) => area.examName || '').filter(Boolean);
        }
      }

      form.setValues({
        displayName: authState.user.displayName || '',
        slug: authState.user.slug || '',
        avatarUrl: authState.user.avatarUrl || '',
        avatarFileId: authState.user.avatarFileId || null,
        bio: authState.user.bio || '',
        tagline: authState.user.tagline || '',
        location: authState.user.location || '',
        languages: authState.user.languages || [],
        responseTime: authState.user.responseTime || '',
        expertiseAreas: migratedExpertiseAreas,
        publicEmail: authState.user.publicEmail || '',
        publicPhone: authState.user.publicPhone || '',
        websiteUrl: authState.user.websiteUrl || '',
        socialLinks: {
          facebook: authState.user.socialLinks?.facebook || '',
          twitter: authState.user.socialLinks?.twitter || '',
          linkedin: authState.user.socialLinks?.linkedin || '',
          instagram: authState.user.socialLinks?.instagram || '',
          youtube: authState.user.socialLinks?.youtube || '',
        },
        awardsCertificates: authState.user.awardsCertificates || [],
      });
    }
  }, [authState, form.setValues]);

  const slug = authState.type === 'authenticated' ? authState.user.slug ?? null : null;
  const publicUrl = slug ? `https://testkart.in/expert/${slug}` : null;

  const onSubmit = async (values: TeacherProfileFormValues) => {
    try {
      await toast.promise(updateProfile.mutateAsync(values), {
        loading: 'Updating profile...',
        success: 'Profile updated successfully!',
        error: (err) => err instanceof Error ? err.message : 'Failed to update profile.',
      });

      // The preview reads the published profile, not the form, so its cache
      // has to go stale the moment a save lands.
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
    const target = typeof firstPath === 'string' ? FIELD_SECTION[firstPath] : undefined;
    if (target) setSection(target);
    toast.error('Some details need fixing before this can be saved.');
  };

  const handleValuesChange = (newValues: Partial<TeacherProfileFormValues>) => {
    form.setValues(prev => ({ ...prev, ...newValues }));
  };

  const handleCopyUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Profile link copied.');
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast.error('Could not copy the link.');
    }
  };

  const completeness = useMemo(() => {
    const values = form.values;
    const checks: { label: string; done: boolean; section: SectionKey }[] = [
      { label: 'Add a profile photo', done: !!values.avatarUrl, section: 'basics' },
      { label: 'Set your display name', done: (values.displayName ?? '').trim().length >= 2, section: 'basics' },
      { label: 'Claim your profile URL', done: !!values.slug, section: 'basics' },
      { label: 'Write a tagline', done: (values.tagline ?? '').trim().length > 0, section: 'basics' },
      { label: 'Write an about section', done: (values.bio ?? '').trim().length >= 40, section: 'basics' },
      { label: 'Add your location', done: (values.location ?? '').trim().length > 0, section: 'details' },
      { label: 'List the languages you teach in', done: (values.languages ?? []).length > 0, section: 'details' },
      { label: 'List your expertise areas', done: (values.expertiseAreas ?? []).length > 0, section: 'details' },
      {
        label: 'Link a website or social profile',
        done:
          (values.websiteUrl ?? '').trim().length > 0 ||
          Object.values(values.socialLinks ?? {}).some((link) => (link ?? '').trim().length > 0),
        section: 'details',
      },
      { label: 'Add an award or certificate', done: (values.awardsCertificates ?? []).length > 0, section: 'credentials' },
    ];

    const done = checks.filter((check) => check.done).length;
    return {
      percent: Math.round((done / checks.length) * 100),
      done,
      total: checks.length,
      next: checks.find((check) => !check.done) ?? null,
    };
  }, [form.values]);

  if (authState.type === 'loading') {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton style={{ height: '2rem', width: '14rem' }} />
        <Skeleton style={{ height: '3rem', width: '100%', borderRadius: 'var(--radius-md)' }} />
        <Skeleton style={{ height: '26rem', width: '100%', borderRadius: 'var(--radius-md)' }} />
      </div>
    );
  }

  if (authState.type !== 'authenticated') {
    return null;
  }

  const { user } = authState;

  const renderSection = () => {
    switch (section) {
      case 'basics':
        return (
          <EditProfileIdentitySection
            formValues={form.values}
            onValuesChange={handleValuesChange}
            isOnboarding={isOnboarding}
            isVerified={user.isVerified || false}
          />
        );
      case 'details':
        return (
          <EditProfileSocialSection
            formValues={form.values}
            onValuesChange={handleValuesChange}
          />
        );
      case 'experience':
        return <EditProfileWorkExperienceSection />;
      case 'credentials':
        return (
          <EditProfileAwardsSection
            formValues={form.values}
            onValuesChange={handleValuesChange}
          />
        );
    }
  };

  return (
    <>
      <Helmet>
        <title>Your profile - Testkart for Teachers</title>
        <meta name="description" content="Edit the public profile students see, and preview it before it goes live." />
      </Helmet>

      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>Your profile</h1>
            <p className={styles.subtitle}>
              {publicUrl ? (
                <>
                  This is the page students land on:{' '}
                  <Link
                    to={`/expert/${slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.urlChip}
                  >
                    testkart.in/expert/{slug}
                    <ExternalLink size={13} aria-hidden="true" />
                  </Link>
                </>
              ) : (
                'Pick a profile URL in Basic information to publish your public page.'
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
              <>
                <Button variant="outline" size="sm" onClick={handleCopyUrl}>
                  <Copy size={15} />
                  Copy link
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/expert/${slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={15} />
                    Open live page
                  </Link>
                </Button>
              </>
            )}
          </div>
        </header>

        {isOnboarding && showOnboardingBanner && (
          <div className={styles.onboardingBanner}>
            <Info className={styles.onboardingBannerIcon} size={20} aria-hidden="true" />
            <div className={styles.onboardingBannerText}>
              <h2 className={styles.onboardingBannerTitle}>Welcome to Testkart</h2>
              <p className={styles.onboardingBannerDescription}>
                Complete your profile before you publish anything. A photo, a display name and a short
                about section are what convince a student to buy from you.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowOnboardingBanner(false)}
              className={styles.onboardingBannerClose}
              aria-label="Dismiss banner"
            >
              <X size={16} />
            </Button>
          </div>
        )}

        {mode === 'edit' ? (
          <div className={styles.editLayout}>
            <aside className={styles.sideColumn}>
              <nav className={styles.sectionNav} aria-label="Profile sections">
                {SECTIONS.map((item) => {
                  const Icon = item.icon;
                  const isActive = section === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`${styles.sectionButton} ${isActive ? styles.sectionButtonActive : ''}`}
                      onClick={() => setSection(item.key)}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <Icon size={18} className={styles.sectionIcon} aria-hidden="true" />
                      <span className={styles.sectionMeta}>
                        <span className={styles.sectionLabel}>{item.label}</span>
                        <span className={styles.sectionHint}>{item.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </nav>

              <div className={styles.strengthCard}>
                <div className={styles.strengthHead}>
                  <span className={styles.strengthTitle}>Profile strength</span>
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
                <p className={styles.strengthText}>
                  {completeness.next
                    ? `${completeness.done} of ${completeness.total} done. Next: ${completeness.next.label.toLowerCase()}.`
                    : 'Every section is filled in. Your page is ready to share.'}
                </p>
                {completeness.next && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={styles.strengthAction}
                    onClick={() => setSection(completeness.next!.section)}
                  >
                    Go to that section
                  </Button>
                )}
              </div>
            </aside>

            <div className={styles.panelColumn}>
              <div className={styles.panel}>
                {section === 'experience' ? (
                  renderSection()
                ) : (
                  <Form {...form}>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleSave();
                      }}
                      className={styles.form}
                    >
                      {renderSection()}
                    </form>
                  </Form>
                )}
              </div>

              {FORM_SECTIONS.includes(section) ? (
                <div className={styles.saveBar}>
                  <span className={styles.saveHint}>
                    Changes go live on your public page as soon as you save.
                  </span>
                  <Button onClick={handleSave} disabled={updateProfile.isPending}>
                    {updateProfile.isPending ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>
              ) : (
                <div className={styles.saveBar}>
                  <span className={styles.saveHint}>
                    Work experience entries save on their own, one at a time.
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <ProfilePreview slug={slug} onGoToBasics={() => { setMode('edit'); setSection('basics'); }} />
        )}
      </div>
    </>
  );
};

const ProfilePreview: React.FC<{ slug: string | null; onGoToBasics: () => void }> = ({
  slug,
  onGoToBasics,
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
        <h2 className={styles.previewEmptyTitle}>Your page does not have a URL yet</h2>
        <p className={styles.previewEmptyText}>
          Pick a profile URL slug in Basic information and save. Your public page goes live at that
          address straight away.
        </p>
        <Button onClick={onGoToBasics}>Choose a profile URL</Button>
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
        <span className={styles.previewNote}>Showing your saved profile</span>
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
