import React, { useState, useEffect } from 'react';
import { Input } from './Input';
import { Badge } from './Badge';
import { Button } from './Button';
import { PhoneNumberInput } from './PhoneNumberInput';
import { User } from '../helpers/User';
import { useSendOtpMutation, useVerifyOtpMutation } from '../helpers/useMobileVerification';
import { useSendEmailOtpMutation, useVerifyEmailOtpMutation } from '../helpers/useEmailVerification';
import styles from './EditProfilePrivateSection.module.css';

interface EditProfilePrivateSectionProps {
  user: User;
}

export const EditProfilePrivateSection: React.FC<EditProfilePrivateSectionProps> = ({
  user,
}) => {
  // Email State
  const [emailState, setEmailState] = useState<'idle' | 'enterValue' | 'verifyOtp'>('idle');
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailTimer, setEmailTimer] = useState(0);

  // Mobile State
  const [mobileState, setMobileState] = useState<'idle' | 'enterValue' | 'verifyOtp'>('idle');
  const [newMobile, setNewMobile] = useState('');
  const [mobileOtp, setMobileOtp] = useState('');
  const [mobileTimer, setMobileTimer] = useState(0);

  const sendEmailOtp = useSendEmailOtpMutation();
  const verifyEmailOtp = useVerifyEmailOtpMutation();
  const sendMobileOtp = useSendOtpMutation();
  const verifyMobileOtp = useVerifyOtpMutation();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (emailTimer > 0) {
      interval = setInterval(() => setEmailTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [emailTimer]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (mobileTimer > 0) {
      interval = setInterval(() => setMobileTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [mobileTimer]);

  const handleSendEmailOtp = () => {
    sendEmailOtp.mutate({ email: newEmail }, {
      onSuccess: () => {
        setEmailState('verifyOtp');
        setEmailTimer(30);
      }
    });
  };

  const handleVerifyEmail = () => {
    verifyEmailOtp.mutate({ email: newEmail, otpCode: emailOtp }, {
      onSuccess: () => {
        setEmailState('idle');
        setNewEmail('');
        setEmailOtp('');
      }
    });
  };

  const handleSendMobileOtp = () => {
    sendMobileOtp.mutate({ mobileNumber: newMobile }, {
      onSuccess: () => {
        setMobileState('verifyOtp');
        setMobileTimer(30);
      }
    });
  };

  const handleVerifyMobile = () => {
    verifyMobileOtp.mutate({ mobileNumber: newMobile, otpCode: mobileOtp }, {
      onSuccess: () => {
        setMobileState('idle');
        setNewMobile('');
        setMobileOtp('');
      }
    });
  };

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail);
  const isValidMobile = /^[6-9]\d{9}$/.test(newMobile);

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Sign-in details</h2>
      <p className={styles.sectionDescription}>
        The email and mobile number you sign in with. Neither appears on your public profile.
      </p>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Email</label>
        
        {emailState === 'idle' && (
          <div className={styles.inputRow}>
            <div className={styles.flex1}>
              <Input
                type="email"
                value={user.email || 'Not connected'}
                disabled
              />
            </div>
            <Button 
              variant="outline" 
              
              onClick={() => {
                setNewEmail(user.email || '');
                setEmailState('enterValue');
              }}
            >
              {user.email ? 'Change' : 'Add Email'}
            </Button>
          </div>
        )}

        {emailState === 'enterValue' && (
          <div className={styles.inputRow}>
            <div className={styles.flex1}>
              <Input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="Enter new email"
                disabled={sendEmailOtp.isPending}
              />
            </div>
            <Button variant="outline" onClick={() => setEmailState('idle')} disabled={sendEmailOtp.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSendEmailOtp} disabled={!isValidEmail || sendEmailOtp.isPending}>
              {sendEmailOtp.isPending ? 'Sending...' : 'Send OTP'}
            </Button>
          </div>
        )}

        {emailState === 'verifyOtp' && (
          <div className={styles.verifyBox}>
            <p className={styles.verifyMessage}>OTP sent to <strong>{newEmail}</strong></p>
            <div className={styles.inputRow}>
              <div className={styles.flex1}>
                <Input
                  type="text"
                  value={emailOtp}
                  onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit OTP"
                  maxLength={6}
                  disabled={verifyEmailOtp.isPending}
                />
              </div>
              <Button variant="outline" onClick={() => setEmailState('idle')} disabled={verifyEmailOtp.isPending}>
                Cancel
              </Button>
              <Button onClick={handleVerifyEmail} disabled={emailOtp.length !== 6 || verifyEmailOtp.isPending}>
                {verifyEmailOtp.isPending ? 'Verifying...' : 'Verify'}
              </Button>
            </div>
            <div className={styles.timerRow}>
              {emailTimer > 0 ? (
                <span className={styles.timerText}>Resend OTP in {emailTimer}s</span>
              ) : (
                <Button variant="link" onClick={handleSendEmailOtp} disabled={sendEmailOtp.isPending} className={styles.resendBtn}>
                  Resend OTP
                </Button>
              )}
            </div>
          </div>
        )}
        
        {emailState === 'idle' && (
          <p className={styles.fieldDescription}>
            Changing it needs a code sent to the new address.
          </p>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>
          Mobile number
          {user.mobileVerified ? (
            <Badge variant="success" style={{ marginLeft: 'var(--spacing-2)' }}>
              Verified
            </Badge>
          ) : (
            user.mobileNumber && (
              <Badge variant="warning" style={{ marginLeft: 'var(--spacing-2)' }}>
                Not verified
              </Badge>
            )
          )}
        </label>
        
        {mobileState === 'idle' && (
          <div className={styles.inputRow}>
            <div className={styles.flex1}>
              <Input
                type="tel"
                value={user.mobileNumber || 'Not connected'}
                disabled
              />
            </div>
            <Button 
              variant="outline" 
              
              onClick={() => {
                setNewMobile(user.mobileNumber || '');
                setMobileState('enterValue');
              }}
            >
              {user.mobileVerified ? 'Change' : 'Add & Verify'}
            </Button>
          </div>
        )}

        {mobileState === 'enterValue' && (
          <div className={styles.inputRow}>
            <div className={styles.flex1}>
              <PhoneNumberInput
                value={newMobile}
                onChange={setNewMobile}
                disabled={sendMobileOtp.isPending}
              />
            </div>
            <Button variant="outline" onClick={() => setMobileState('idle')} disabled={sendMobileOtp.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSendMobileOtp} disabled={!isValidMobile || sendMobileOtp.isPending}>
              {sendMobileOtp.isPending ? 'Sending...' : 'Send OTP'}
            </Button>
          </div>
        )}

        {mobileState === 'verifyOtp' && (
          <div className={styles.verifyBox}>
            <p className={styles.verifyMessage}>OTP sent to <strong>{newMobile}</strong></p>
            <div className={styles.inputRow}>
              <div className={styles.flex1}>
                <Input
                  type="text"
                  value={mobileOtp}
                  onChange={e => setMobileOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="4-digit OTP"
                  maxLength={4}
                  disabled={verifyMobileOtp.isPending}
                />
              </div>
              <Button variant="outline" onClick={() => setMobileState('idle')} disabled={verifyMobileOtp.isPending}>
                Cancel
              </Button>
              <Button onClick={handleVerifyMobile} disabled={mobileOtp.length !== 4 || verifyMobileOtp.isPending}>
                {verifyMobileOtp.isPending ? 'Verifying...' : 'Verify'}
              </Button>
            </div>
            <div className={styles.timerRow}>
              {mobileTimer > 0 ? (
                <span className={styles.timerText}>Resend OTP in {mobileTimer}s</span>
              ) : (
                <Button variant="link" onClick={handleSendMobileOtp} disabled={sendMobileOtp.isPending} className={styles.resendBtn}>
                  Resend OTP
                </Button>
              )}
            </div>
          </div>
        )}
        
        {mobileState === 'idle' && (
          <p className={styles.fieldDescription}>
            Changing it needs a code sent to the new number.
          </p>
        )}
      </div>
    </div>
  );
};