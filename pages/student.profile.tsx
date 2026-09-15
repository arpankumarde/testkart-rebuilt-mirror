import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ShieldCheck, ShieldAlert, Trash2, Camera, User as UserIcon, Shield, AlertTriangle, Smartphone } from 'lucide-react';

import { useAuth } from '../helpers/useAuth';
import { useSendOtpMutation, useVerifyOtpMutation } from '../helpers/useMobileVerification';
import { PhoneNumberInput } from '../components/PhoneNumberInput';
import { useStudentProfileMutations } from '../helpers/useStudentProfileMutations';
import { useUploadLimits } from '../helpers/useUploadLimits';
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '../components/Form';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { EmailConnectionPrompt } from '../components/EmailConnectionPrompt';
import { R2FileUploader } from '../components/R2FileUploader';
import { BillingDetailsSection } from '../components/BillingDetailsSection';
import { ConsolePageHeader } from '../components/ConsolePageHeader';

import styles from './student.profile.module.css';

const profileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters.'),
  avatarUrl: z.string().url('Please enter a valid URL.').or(z.literal('')).nullable(),
  avatarFileId: z.string().nullable().optional(),
  bio: z.string().max(500, 'Bio must be 500 characters or less.').optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const StudentProfilePage: React.FC = () => {
  const { authState } = useAuth();
  const { useUpdateStudentProfileMutation } = useStudentProfileMutations();
  const updateProfile = useUpdateStudentProfileMutation();
  const limits = useUploadLimits();

  const form = useForm({
    schema: profileSchema,
    defaultValues: {
      displayName: '',
      avatarUrl: '',
      avatarFileId: null,
      bio: '',
    },
  });

  useEffect(() => {
    if (authState.type === 'authenticated') {
      const { user } = authState;
      form.setValues({
        displayName: user.displayName || '',
        avatarUrl: user.avatarUrl || '',
        avatarFileId: user.avatarFileId || null,
        bio: user.bio || '',
      });
    }
  }, [authState, form.setValues]);

  const [isUploadingPhoto, setIsUploadingPhoto] = React.useState(false);
  const [mobileChangeStep, setMobileChangeStep] = React.useState<'idle' | 'enterNumber' | 'enterOtp'>('idle');
  const [newMobileNumber, setNewMobileNumber] = React.useState('');
  const [otpCode, setOtpCode] = React.useState('');
  const [resendTimer, setResendTimer] = React.useState(0);

  const sendOtpMutation = useSendOtpMutation();
  const verifyOtpMutation = useVerifyOtpMutation();

  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendTimer > 0) {
      timer = setTimeout(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const handleSendOtp = async (number: string) => {
    try {
      await sendOtpMutation.mutateAsync({ mobileNumber: number });
      setMobileChangeStep('enterOtp');
      setOtpCode('');
      setResendTimer(30);
    } catch (error) {
      // Error handled by mutation toast
    }
  };

  const handleVerifyOtp = async () => {
    try {
      await verifyOtpMutation.mutateAsync({ 
        mobileNumber: newMobileNumber, 
        otpCode 
      });
      setMobileChangeStep('idle');
      setNewMobileNumber('');
      setOtpCode('');
    } catch (error) {
      // Error handled by mutation toast
    }
  };

  const handleVerifyNow = () => {
    if (user.mobileNumber) {
      setNewMobileNumber(user.mobileNumber);
      handleSendOtp(user.mobileNumber);
    }
  };

  const handleUploadSuccess = (result: { filePath: string; fileId: string; url: string }) => {
    setIsUploadingPhoto(false);
    console.log('R2 upload successful:', result);
    form.setValues(prev => ({ 
      ...prev, 
      avatarUrl: result.url,
      avatarFileId: result.fileId 
    }));
  };

  const onSubmit = (values: ProfileFormValues) => {
    toast.promise(updateProfile.mutateAsync(values), {
      loading: 'Updating profile...',
      success: 'Profile updated successfully!',
      error: (err) => err instanceof Error ? err.message : 'Failed to update profile.',
    });
  };

  if (authState.type === 'loading') {
    return (
      <div className={styles.page}>
        <Skeleton className={styles.skeletonBlock} style={{ height: '7rem' }} />
        <Skeleton className={styles.skeletonBlock} style={{ height: '16rem' }} />
        <Skeleton className={styles.skeletonBlock} style={{ height: '16rem' }} />
      </div>
    );
  }

  if (authState.type !== 'authenticated') {
    return null; // Or a redirect component
  }

  const { user } = authState;
  const avatarInitial = form.values.displayName?.charAt(0).toUpperCase() || user.displayName?.charAt(0).toUpperCase() || '?';

  return (
    <>
      <Helmet>
        <title>My Profile - Testkart</title>
        <meta name="description" content="View and update your Testkart student profile." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Profile" />

        <div className={styles.identityCard}>
          <Avatar className={styles.identityAvatar}>
            <AvatarImage src={form.values.avatarUrl || undefined} alt="" />
            <AvatarFallback>{avatarInitial}</AvatarFallback>
          </Avatar>
          <div className={styles.identityText}>
            <h2 className={styles.identityName}>{form.values.displayName || user.displayName}</h2>
            <p className={styles.identityEmail}>{user.email || 'No email connected'}</p>
          </div>
          <div className={styles.photoUploadWrapper}>
            <Button type="button" variant="outline" size="sm" disabled={isUploadingPhoto}>
              <Camera size={16} />
              {isUploadingPhoto ? 'Uploading...' : 'Change photo'}
            </Button>
            <div className={styles.invisibleFormItem}>
              <R2FileUploader
                folder="/avatars/students"
                onUploadStart={() => setIsUploadingPhoto(true)}
                onSuccess={handleUploadSuccess}
                onError={(error) => {
                  setIsUploadingPhoto(false);
                  console.error('Upload error:', error);
                  toast.error(error.message || 'Failed to upload image.');
                }}
                currentImageUrl={form.values.avatarUrl || undefined}
                currentFileId={form.values.avatarFileId || undefined}
                acceptedTypes=".jpg,.jpeg,.png"
                maxSizeInMB={limits.profilePictureMaxMb}
                label=""
                enableCrop={true}
                cropAspect={1}
                cropShape="round"
                className={styles.invisibleUploader}
              />
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={styles.formContainer}>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIconWrapper}>
                  <UserIcon size={20} />
                </div>
                <div>
                  <h2 className={styles.cardTitle}>Personal information</h2>
                  <p className={styles.cardDescription}>Your name and bio, as other people see them</p>
                </div>
              </div>
              <div className={styles.cardContent}>
                <FormItem name="displayName">
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input
                      value={form.values.displayName}
                      onChange={(e) => form.setValues(prev => ({ ...prev, displayName: e.target.value }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="bio">
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us a little about yourself..."
                      value={form.values.bio || ''}
                      onChange={(e) => form.setValues(prev => ({ ...prev, bio: e.target.value }))}
                      rows={4}
                    />
                  </FormControl>
                  <FormDescription>A brief description for your public profile.</FormDescription>
                  <FormMessage />
                </FormItem>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIconWrapper}>
                  <Shield size={20} />
                </div>
                <div>
                  <h2 className={styles.cardTitle}>Contact and verification</h2>
                  <p className={styles.cardDescription}>How Testkart reaches you, and what is confirmed</p>
                </div>
              </div>
              <div className={styles.cardContent}>
                {user.email ? (
                  <FormItem name="email">
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input type="email" value={user.email || ''} disabled />
                    </FormControl>
                    <FormDescription>Your email address cannot be changed.</FormDescription>
                  </FormItem>
                ) : (
                  <EmailConnectionPrompt userRole="student" />
                )}

                <div className={styles.verificationSection}>
                  <label className={styles.verificationSectionLabel}>Mobile number</label>
                  {mobileChangeStep === 'idle' ? (
                    <div className={styles.verificationItem}>
                      <div className={styles.verificationLabel}>
                        {user.mobileNumber ? (
                          user.mobileVerified ? <ShieldCheck className={styles.iconSuccess} size={20} /> : <ShieldAlert className={styles.iconWarning} size={20} />
                        ) : (
                          <Smartphone className={styles.iconDefault} size={20} />
                        )}
                        <span>{user.mobileNumber || 'No mobile number added'}</span>
                      </div>
                      <div className={styles.verificationStatus}>
                        {user.mobileNumber ? (
                          user.mobileVerified ? (
                            <>
                              <Badge variant="success">Verified</Badge>
                              <Button variant="outline" size="sm" onClick={() => { setMobileChangeStep('enterNumber'); setNewMobileNumber(''); }}>Change number</Button>
                            </>
                          ) : (
                            <>
                              <Badge variant="warning">Not verified</Badge>
                              <Button variant="primary" size="sm" onClick={handleVerifyNow}>Verify now</Button>
                              <Button variant="outline" size="sm" onClick={() => { setMobileChangeStep('enterNumber'); setNewMobileNumber(''); }}>Change number</Button>
                            </>
                          )
                        ) : (
                          <Button variant="primary" size="sm" onClick={() => { setMobileChangeStep('enterNumber'); setNewMobileNumber(''); }}>Add mobile number</Button>
                        )}
                      </div>
                    </div>
                  ) : mobileChangeStep === 'enterNumber' ? (
                    <div className={styles.inlineForm}>
                      <p className={styles.inlineFormTitle}>{user.mobileNumber ? 'Change Mobile Number' : 'Add Mobile Number'}</p>
                      <div className={styles.inlineFormRow}>
                        <PhoneNumberInput 
                          value={newMobileNumber} 
                          onChange={setNewMobileNumber} 
                        />
                      </div>
                      <div className={styles.inlineFormActions}>
                        <Button variant="ghost" onClick={() => setMobileChangeStep('idle')}>Cancel</Button>
                        <Button 
                          onClick={() => handleSendOtp(newMobileNumber)} 
                          disabled={newMobileNumber.length !== 10 || sendOtpMutation.isPending}
                        >
                          {sendOtpMutation.isPending ? 'Sending...' : 'Send OTP'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.inlineForm}>
                      <p className={styles.inlineFormTitle}>Verify Mobile Number</p>
                      <p className={styles.inlineFormDesc}>OTP sent to {newMobileNumber}</p>
                      <div className={styles.inlineFormRow}>
                        <Input 
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          maxLength={4}
                          inputMode="numeric"
                          placeholder="Enter 4-digit OTP"
                          autoFocus
                        />
                      </div>
                      <div className={styles.inlineFormActions}>
                        <Button variant="ghost" onClick={() => setMobileChangeStep('idle')}>Cancel</Button>
                        <Button 
                          variant="ghost" 
                          onClick={() => handleSendOtp(newMobileNumber)} 
                          disabled={resendTimer > 0 || sendOtpMutation.isPending}
                        >
                          {resendTimer > 0 ? `Resend OTP (${resendTimer}s)` : 'Resend OTP'}
                        </Button>
                        <Button 
                          onClick={handleVerifyOtp} 
                          disabled={otpCode.length !== 4 || verifyOtpMutation.isPending}
                        >
                          {verifyOtpMutation.isPending ? 'Verifying...' : 'Verify OTP'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.formActions}>
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>

        <BillingDetailsSection />

        <div className={styles.dangerCard}>
          <div className={styles.dangerCardContent}>
            <div className={styles.dangerIconWrapper}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className={styles.dangerTitle}>Close your account</h2>
              <p className={styles.dangerDescription}>
                This deletes your account and everything in it. It cannot be undone.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className={styles.dangerButton}>
            <Link to="/close-account">
              <Trash2 size={16} />
              Close account
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
};

export default StudentProfilePage;