import { uiLocale } from '@/utils/uiLocale';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { usePlatform } from '@/platform';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/auth';
import { displayName } from '../utils/displayName';
import { authApi } from '../api/auth';
import { isValidEmail } from '../utils/validation';
import { useCountdown } from '../hooks/useCountdown';
import { useTheme } from '../hooks/useTheme';
import { useUserAvatar } from '../hooks/useUserAvatar';
import { useCurrency } from '../hooks/useCurrency';
import { getApiErrorMessage } from '../utils/api-error';
import {
  notificationsApi,
  type NotificationSettings,
  type NotificationSettingsUpdate,
} from '../api/notifications';
import { referralApi } from '../api/referral';
import { balanceApi } from '../api/balance';
import { brandingApi, type EmailAuthEnabled } from '../api/branding';
import { themeColorsApi } from '../api/themeColors';
import { UI } from '../config/constants';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Card } from '@/components/data-display/Card';
import { Button } from '@/components/primitives/Button';
import { Switch } from '@/components/primitives/Switch';
import { staggerContainer, staggerItem } from '@/components/motion/transitions';
import { WebBackButton } from '../components/WebBackButton';
import {
  ArrowRightIcon,
  BellIcon,
  CheckIcon,
  ChevronDownIcon,
  InfoIcon,
  LogoutIcon,
  MoonIcon,
  PencilIcon,
  SunIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from '@/components/icons';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();
  const avatar = useUserAvatar(user);
  const { isDark, toggleTheme } = useTheme();
  const { formatAmount, currencySymbol } = useCurrency();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Inline email change flow
  const [changeEmailStep, setChangeEmailStep] = useState<'email' | 'code' | 'success' | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [changeCode, setChangeCode] = useState('');
  const [changeError, setChangeError] = useState<string | null>(null);
  const [resendCooldown, startResendCooldown] = useCountdown();
  const [verificationResendCooldown, startVerificationResendCooldown] = useCountdown();
  const newEmailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Referral data
  const { data: referralInfo } = useQuery({
    queryKey: ['referral-info'],
    queryFn: referralApi.getReferralInfo,
  });

  const { data: referralTerms } = useQuery({
    queryKey: ['referral-terms'],
    queryFn: referralApi.getReferralTerms,
  });

  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn: balanceApi.getBalance,
  });

  // Check if email auth is enabled
  const { data: emailAuthConfig } = useQuery<EmailAuthEnabled>({
    queryKey: ['email-auth-enabled'],
    queryFn: brandingApi.getEmailAuthEnabled,
    staleTime: 60000,
  });
  const isEmailAuthEnabled = emailAuthConfig?.enabled ?? true;
  const isEmailVerificationEnabled = emailAuthConfig?.verification_enabled ?? true;

  const { data: enabledThemes } = useQuery({
    queryKey: ['enabled-themes'],
    queryFn: themeColorsApi.getEnabledThemes,
    staleTime: 1000 * 60 * 5,
  });
  const canToggleTheme = enabledThemes?.dark && enabledThemes?.light;

  const resendVerificationMutation = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => {
      setSuccess(t('profile.verificationResent'));
      setError(null);
      startVerificationResendCooldown(UI.RESEND_COOLDOWN_SEC);
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, t('common.error')));
      setSuccess(null);
    },
  });

  // Email change mutations
  const requestEmailChangeMutation = useMutation({
    mutationFn: (emailAddr: string) => authApi.requestEmailChange(emailAddr),
    onSuccess: async (data) => {
      setChangeError(null);
      if (data.expires_in_minutes === 0) {
        // Unverified email was replaced directly
        setChangeEmailStep('success');
        const updatedUser = await authApi.getMe();
        setUser(updatedUser);
      } else {
        setChangeEmailStep('code');
        startResendCooldown(UI.RESEND_COOLDOWN_SEC);
      }
    },
    onError: (err: unknown) => {
      const detail = getApiErrorMessage(err, '');
      if (detail.includes('already registered') || detail.includes('already in use')) {
        setChangeError(t('profile.changeEmail.emailAlreadyUsed'));
      } else if (detail.includes('same as current')) {
        setChangeError(t('profile.changeEmail.sameEmail'));
      } else if (detail.includes('rate limit') || detail.includes('too many')) {
        setChangeError(t('profile.changeEmail.tooManyRequests'));
      } else {
        setChangeError(detail || t('common.error'));
      }
    },
  });

  const verifyEmailChangeMutation = useMutation({
    mutationFn: (verificationCode: string) => authApi.verifyEmailChange(verificationCode),
    onSuccess: async () => {
      setChangeError(null);
      setChangeEmailStep('success');
      const updatedUser = await authApi.getMe();
      setUser(updatedUser);
      // Note: auth user lives in the zustand store, not in React Query —
      // the explicit setUser above IS the refresh. No ['user'] query exists.
    },
    onError: (err: unknown) => {
      const detail = getApiErrorMessage(err, '');
      if (detail.includes('invalid') || detail.includes('wrong')) {
        setChangeError(t('profile.changeEmail.invalidCode'));
      } else if (detail.includes('expired')) {
        setChangeError(t('profile.changeEmail.codeExpired'));
      } else {
        setChangeError(detail || t('common.error'));
      }
    },
  });

  const resetChangeEmail = useCallback(() => {
    setChangeEmailStep(null);
    setNewEmail('');
    setChangeCode('');
    setChangeError(null);
    startResendCooldown(0);
  }, [startResendCooldown]);

  // Auto-focus inputs on step change (skip on Telegram — keyboard hides bottom nav)
  const { platform: profilePlatform } = usePlatform();
  useEffect(() => {
    if (profilePlatform === 'telegram') return;
    const timer = setTimeout(() => {
      if (changeEmailStep === 'email') newEmailInputRef.current?.focus();
      else if (changeEmailStep === 'code') codeInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [changeEmailStep, profilePlatform]);

  // Auto-close success after 3s
  useEffect(() => {
    if (changeEmailStep !== 'success') return;
    const timer = setTimeout(() => resetChangeEmail(), 3000);
    return () => clearTimeout(timer);
  }, [changeEmailStep, resetChangeEmail]);

  const handleSendChangeCode = () => {
    setChangeError(null);
    if (!newEmail.trim()) {
      setChangeError(t('profile.emailRequired'));
      return;
    }
    if (!isValidEmail(newEmail.trim())) {
      setChangeError(t('profile.invalidEmail'));
      return;
    }
    if (user?.email && newEmail.toLowerCase().trim() === user.email.toLowerCase()) {
      setChangeError(t('profile.changeEmail.sameEmail'));
      return;
    }
    requestEmailChangeMutation.mutate(newEmail.trim());
  };

  const handleVerifyChangeCode = () => {
    setChangeError(null);
    if (!changeCode.trim()) {
      setChangeError(t('profile.changeEmail.enterCode'));
      return;
    }
    if (changeCode.trim().length < 4) {
      setChangeError(t('profile.changeEmail.invalidCode'));
      return;
    }
    verifyEmailChangeMutation.mutate(changeCode.trim());
  };

  const handleResendChangeCode = () => {
    if (resendCooldown > 0) return;
    requestEmailChangeMutation.mutate(newEmail.trim());
  };

  const { data: notificationSettings, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: notificationsApi.getSettings,
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: notificationsApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
  });

  const handleNotificationToggle = (key: keyof NotificationSettings, value: boolean) => {
    const update: NotificationSettingsUpdate = { [key]: value };
    updateNotificationsMutation.mutate(update);
  };

  const handleNotificationValue = (key: keyof NotificationSettings, value: number) => {
    const update: NotificationSettingsUpdate = { [key]: value };
    updateNotificationsMutation.mutate(update);
  };

  const openNotificationSettings = () => {
    setNotificationsOpen(true);
    requestAnimationFrame(() => {
      document
        .getElementById('profile-notification-settings')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItem}>
        <div className="flex items-center gap-3">
          <WebBackButton
            to="/"
            showInTelegram
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dark-700 bg-dark-800 transition-colors hover:border-dark-600 lg:hidden"
          />
          <h1 className="text-2xl font-bold text-dark-50 sm:text-3xl">{t('profile.title')}</h1>
        </div>
      </motion.div>

      {/* Profile summary */}
      <motion.div variants={staggerItem}>
        <Card className="bg-gradient-to-br from-accent-500/10 via-dark-900/80 to-dark-900">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-accent-500/30 bg-accent-500/10 sm:h-20 sm:w-20">
              {avatar.src ? (
                <img
                  src={avatar.src}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={avatar.onError}
                />
              ) : (
                <UserIcon className="h-8 w-8 text-accent-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-semibold text-dark-50 sm:text-2xl">
                  {displayName(user)}
                </h2>
                {isAdmin && (
                  <span className="rounded-full border border-warning-500/30 bg-warning-500/10 px-2 py-0.5 text-xs font-medium text-warning-400">
                    {t('admin.nav.title')}
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-sm text-dark-400">
                {user?.username ? `@${user.username}` : `Telegram ID ${user?.telegram_id ?? '—'}`}
              </p>
              {user?.email && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="max-w-full truncate rounded-full bg-dark-800/80 px-2.5 py-1 text-dark-300">
                    {user.email}
                  </span>
                  {isEmailVerificationEnabled && (
                    <span className={user.email_verified ? 'badge-success' : 'badge-warning'}>
                      {user.email_verified ? t('profile.verified') : t('profile.notVerified')}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-dark-800/60 pt-4">
            <div className="min-w-0 rounded-xl bg-dark-950/35 px-3 py-2.5">
              <span className="block text-xs text-dark-500">{t('profile.telegramId')}</span>
              <span className="mt-0.5 block truncate text-sm font-medium text-dark-200">
                {user?.telegram_id ?? '—'}
              </span>
            </div>
            <div className="min-w-0 rounded-xl bg-dark-950/35 px-3 py-2.5">
              <span className="block text-xs text-dark-500">{t('profile.registeredAt')}</span>
              <span className="mt-0.5 block truncate text-sm font-medium text-dark-200">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString(uiLocale()) : '—'}
              </span>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Profile sections */}
      <motion.div variants={staggerItem}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <Link
            to="/balance"
            className="group flex min-h-28 flex-col justify-between rounded-[var(--bento-radius)] border border-dark-700/40 bg-dark-900/70 p-4 transition-colors hover:border-accent-500/30 hover:bg-dark-800/60"
          >
            <WalletIcon className="h-6 w-6 text-accent-400" />
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <span className="block font-medium text-dark-100">{t('nav.balance')}</span>
                <span className="block truncate text-xs text-dark-500">
                  {formatAmount(balanceData?.balance_rubles || 0)} {currencySymbol}
                </span>
              </div>
              <ArrowRightIcon className="h-4 w-4 shrink-0 text-dark-500 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>

          <Link
            to="/profile/accounts"
            className="group flex min-h-28 flex-col justify-between rounded-[var(--bento-radius)] border border-dark-700/40 bg-dark-900/70 p-4 transition-colors hover:border-accent-500/30 hover:bg-dark-800/60"
          >
            <UserIcon className="h-6 w-6 text-accent-400" />
            <div className="flex items-end justify-between gap-2">
              <span className="font-medium text-dark-100">
                {t('profile.accounts.goToAccounts')}
              </span>
              <ArrowRightIcon className="h-4 w-4 shrink-0 text-dark-500 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>

          {referralTerms?.is_enabled && (
            <Link
              to="/referral"
              className="group flex min-h-28 flex-col justify-between rounded-[var(--bento-radius)] border border-dark-700/40 bg-dark-900/70 p-4 transition-colors hover:border-accent-500/30 hover:bg-dark-800/60"
            >
              <UsersIcon className="h-6 w-6 text-accent-400" />
              <div className="flex items-end justify-between gap-2">
                <div>
                  <span className="block font-medium text-dark-100">{t('nav.referral')}</span>
                  <span className="text-xs text-dark-500">
                    {referralInfo?.total_referrals ?? 0}
                  </span>
                </div>
                <ArrowRightIcon className="h-4 w-4 shrink-0 text-dark-500 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          )}

          <Link
            to="/info"
            className="group flex min-h-28 flex-col justify-between rounded-[var(--bento-radius)] border border-dark-700/40 bg-dark-900/70 p-4 transition-colors hover:border-accent-500/30 hover:bg-dark-800/60"
          >
            <InfoIcon className="h-6 w-6 text-accent-400" />
            <div className="flex items-end justify-between gap-2">
              <span className="font-medium text-dark-100">{t('nav.info')}</span>
              <ArrowRightIcon className="h-4 w-4 shrink-0 text-dark-500 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>

          <button
            type="button"
            onClick={openNotificationSettings}
            className="group col-span-2 flex min-h-28 flex-col justify-between rounded-[var(--bento-radius)] border border-dark-700/40 bg-dark-900/70 p-4 text-left transition-colors hover:border-accent-500/30 hover:bg-dark-800/60 sm:col-span-1"
          >
            <BellIcon className="h-6 w-6 text-accent-400" />
            <div className="flex w-full items-end justify-between gap-2">
              <span className="font-medium text-dark-100">{t('profile.notifications.title')}</span>
              <ChevronDownIcon className="h-4 w-4 shrink-0 text-dark-500" />
            </div>
          </button>
        </div>
      </motion.div>

      {/* Email Section - only show when email auth is enabled */}
      {isEmailAuthEnabled && (
        <motion.div variants={staggerItem}>
          <Card>
            <h2 className="mb-6 text-lg font-semibold text-dark-100">{t('profile.emailAuth')}</h2>

            {user?.email ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-dark-800/50 py-3">
                  <span className="text-dark-400">Email</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-dark-100">{user.email}</span>
                    {user.email_verified ? (
                      <span className="badge-success">{t('profile.verified')}</span>
                    ) : isEmailVerificationEnabled ? (
                      <span className="badge-warning">{t('profile.notVerified')}</span>
                    ) : null}
                  </div>
                </div>

                {!user.email_verified && isEmailVerificationEnabled && (
                  <div className="rounded-linear border border-warning-500/30 bg-warning-500/10 p-4">
                    <p className="mb-4 text-sm text-warning-400">
                      {t('profile.verificationRequired')}
                    </p>
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => resendVerificationMutation.mutate()}
                        loading={resendVerificationMutation.isPending}
                        disabled={verificationResendCooldown > 0}
                      >
                        {verificationResendCooldown > 0
                          ? t('profile.resendIn', { seconds: verificationResendCooldown })
                          : t('profile.resendVerification')}
                      </Button>
                      <button
                        onClick={() => setChangeEmailStep('email')}
                        className="text-sm text-accent-400 transition-colors hover:text-accent-300"
                      >
                        {t('profile.changeEmail.button')}
                      </button>
                    </div>
                  </div>
                )}

                {user.email_verified && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-dark-400">{t('profile.canLoginWithEmail')}</p>
                    <button
                      onClick={() => setChangeEmailStep('email')}
                      className="flex items-center gap-2 text-sm text-accent-400 transition-colors hover:text-accent-300"
                    >
                      <PencilIcon />
                      <span>{t('profile.changeEmail.button')}</span>
                    </button>
                  </div>
                )}

                {/* Inline email change flow */}
                <AnimatePresence>
                  {changeEmailStep === 'email' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 border-t border-dark-800/50 pt-4">
                        <label className="block text-sm font-medium text-dark-400">
                          {t('profile.changeEmail.newEmail')}
                        </label>
                        <input
                          ref={newEmailInputRef}
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSendChangeCode();
                            }
                          }}
                          placeholder="new@email.com"
                          className="input w-full"
                          autoComplete="email"
                        />
                        {changeError && <p className="text-sm text-error-400">{changeError}</p>}
                        <div className="flex items-center gap-3">
                          <Button
                            onClick={handleSendChangeCode}
                            loading={requestEmailChangeMutation.isPending}
                            disabled={!newEmail.trim()}
                          >
                            {t('profile.changeEmail.sendCode')}
                          </Button>
                          <button
                            onClick={resetChangeEmail}
                            className="text-sm text-dark-400 hover:text-dark-200"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {changeEmailStep === 'code' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 border-t border-dark-800/50 pt-4">
                        <div className="rounded-linear border border-accent-500/30 bg-accent-500/10 p-3">
                          <p className="text-sm text-accent-400">
                            {t('profile.changeEmail.codeSentTo', { email: newEmail })}
                          </p>
                        </div>
                        <label className="block text-sm font-medium text-dark-400">
                          {t('profile.changeEmail.verificationCode')}
                        </label>
                        <input
                          ref={codeInputRef}
                          type="text"
                          inputMode="numeric"
                          value={changeCode}
                          onChange={(e) => setChangeCode(e.target.value.replace(/\D/g, ''))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleVerifyChangeCode();
                            }
                          }}
                          placeholder="000000"
                          maxLength={6}
                          className="input w-full text-center text-2xl tracking-[0.5em]"
                          autoComplete="one-time-code"
                        />
                        {changeError && <p className="text-sm text-error-400">{changeError}</p>}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Button
                              onClick={handleVerifyChangeCode}
                              loading={verifyEmailChangeMutation.isPending}
                              disabled={!changeCode.trim()}
                            >
                              {t('profile.changeEmail.verify')}
                            </Button>
                            <button
                              onClick={() => {
                                setChangeEmailStep('email');
                                setChangeCode('');
                                setChangeError(null);
                              }}
                              className="text-sm text-dark-400 hover:text-dark-200"
                            >
                              {t('common.back')}
                            </button>
                          </div>
                          <button
                            onClick={handleResendChangeCode}
                            disabled={resendCooldown > 0 || requestEmailChangeMutation.isPending}
                            className={`text-sm ${resendCooldown > 0 ? 'text-dark-500' : 'text-accent-400 hover:text-accent-300'}`}
                          >
                            {resendCooldown > 0
                              ? t('profile.changeEmail.resendIn', { seconds: resendCooldown })
                              : t('profile.changeEmail.resendCode')}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {changeEmailStep === 'success' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-dark-800/50 pt-4">
                        <div className="flex items-center gap-3 rounded-linear border border-success-500/30 bg-success-500/10 p-4">
                          <CheckIcon />
                          <div>
                            <p className="font-medium text-success-400">
                              {t('profile.changeEmail.success')}
                            </p>
                            <p className="text-sm text-dark-400">{newEmail}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-dark-400">{t('profile.linkEmailDescription')}</p>
                <Button variant="primary" onClick={() => navigate('/profile/accounts')}>
                  {t('profile.linkEmail')}
                </Button>
              </div>
            )}

            {(error || success) && user?.email && (
              <div className="mt-4">
                {error && (
                  <div className="rounded-linear border border-error-500/30 bg-error-500/10 p-4 text-sm text-error-400">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="rounded-linear border border-success-500/30 bg-success-500/10 p-4 text-sm text-success-400">
                    {success}
                  </div>
                )}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* Notification Settings */}
      <motion.div id="profile-notification-settings" variants={staggerItem}>
        <Card size="md">
          <button
            type="button"
            onClick={() => setNotificationsOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={notificationsOpen}
          >
            <span className="flex items-center gap-3 font-semibold text-dark-100">
              <BellIcon className="h-5 w-5 text-accent-400" />
              {t('profile.notifications.title')}
            </span>
            <ChevronDownIcon
              className={`h-5 w-5 shrink-0 text-dark-400 transition-transform ${notificationsOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence initial={false}>
            {notificationsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-dark-800/50 pt-5 mt-4">
                  {notificationsLoading ? (
                    <SkeletonGroup className="space-y-3">
                      <Skeleton variant="card" count={3} className="h-16" />
                    </SkeletonGroup>
                  ) : notificationSettings ? (
                    <div className="space-y-6">
                      {/* Subscription Expiry */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-dark-100">
                              {t('profile.notifications.subscriptionExpiry')}
                            </p>
                            <p className="text-sm text-dark-400">
                              {t('profile.notifications.subscriptionExpiryDesc')}
                            </p>
                          </div>
                          <Switch
                            checked={notificationSettings.subscription_expiry_enabled}
                            onCheckedChange={(checked) =>
                              handleNotificationToggle('subscription_expiry_enabled', checked)
                            }
                          />
                        </div>
                        {notificationSettings.subscription_expiry_enabled && (
                          <div className="flex items-center gap-3 pl-4">
                            <span className="text-sm text-dark-400">
                              {t('profile.notifications.daysBeforeExpiry')}
                            </span>
                            <select
                              value={notificationSettings.subscription_expiry_days}
                              onChange={(e) =>
                                handleNotificationValue(
                                  'subscription_expiry_days',
                                  Number(e.target.value),
                                )
                              }
                              className="input w-20 py-1"
                            >
                              {[1, 2, 3, 5, 7, 14].map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Traffic Warning */}
                      <div className="space-y-3 border-t border-dark-800/50 pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-dark-100">
                              {t('profile.notifications.trafficWarning')}
                            </p>
                            <p className="text-sm text-dark-400">
                              {t('profile.notifications.trafficWarningDesc')}
                            </p>
                          </div>
                          <Switch
                            checked={notificationSettings.traffic_warning_enabled}
                            onCheckedChange={(checked) =>
                              handleNotificationToggle('traffic_warning_enabled', checked)
                            }
                          />
                        </div>
                        {notificationSettings.traffic_warning_enabled && (
                          <div className="flex items-center gap-3 pl-4">
                            <span className="text-sm text-dark-400">
                              {t('profile.notifications.atPercent')}
                            </span>
                            <select
                              value={notificationSettings.traffic_warning_percent}
                              onChange={(e) =>
                                handleNotificationValue(
                                  'traffic_warning_percent',
                                  Number(e.target.value),
                                )
                              }
                              className="input w-20 py-1"
                            >
                              {[50, 70, 80, 90, 95].map((p) => (
                                <option key={p} value={p}>
                                  {p}%
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Balance Low */}
                      <div className="space-y-3 border-t border-dark-800/50 pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-dark-100">
                              {t('profile.notifications.balanceLow')}
                            </p>
                            <p className="text-sm text-dark-400">
                              {t('profile.notifications.balanceLowDesc')}
                            </p>
                          </div>
                          <Switch
                            checked={notificationSettings.balance_low_enabled}
                            onCheckedChange={(checked) =>
                              handleNotificationToggle('balance_low_enabled', checked)
                            }
                          />
                        </div>
                        {notificationSettings.balance_low_enabled && (
                          <div className="flex items-center gap-3 pl-4">
                            <span className="text-sm text-dark-400">
                              {t('profile.notifications.threshold')}
                            </span>
                            <input
                              type="number"
                              value={notificationSettings.balance_low_threshold}
                              onChange={(e) =>
                                handleNotificationValue(
                                  'balance_low_threshold',
                                  Number(e.target.value),
                                )
                              }
                              min={0}
                              className="input w-24 py-1"
                            />
                          </div>
                        )}
                      </div>

                      {/* News */}
                      <div className="flex items-center justify-between border-t border-dark-800/50 pt-6">
                        <div>
                          <p className="font-medium text-dark-100">
                            {t('profile.notifications.news')}
                          </p>
                          <p className="text-sm text-dark-400">
                            {t('profile.notifications.newsDesc')}
                          </p>
                        </div>
                        <Switch
                          checked={notificationSettings.news_enabled}
                          onCheckedChange={(checked) =>
                            handleNotificationToggle('news_enabled', checked)
                          }
                        />
                      </div>

                      {/* Promo Offers */}
                      <div className="flex items-center justify-between border-t border-dark-800/50 pt-6">
                        <div>
                          <p className="font-medium text-dark-100">
                            {t('profile.notifications.promoOffers')}
                          </p>
                          <p className="text-sm text-dark-400">
                            {t('profile.notifications.promoOffersDesc')}
                          </p>
                        </div>
                        <Switch
                          checked={notificationSettings.promo_offers_enabled}
                          onCheckedChange={(checked) =>
                            handleNotificationToggle('promo_offers_enabled', checked)
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-dark-400">{t('profile.notifications.unavailable')}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* Mobile-only controls formerly hidden behind the gear menu */}
      <motion.div variants={staggerItem} className="space-y-3 lg:hidden">
        <Card size="md" className="overflow-visible">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-dark-200">
              {t('admin.buttons.sections.language')}
            </span>
            <LanguageSwitcher />
          </div>
          {canToggleTheme && (
            <div className="mt-3 flex w-full items-center justify-between border-t border-dark-800/50 pt-4">
              <span className="flex items-center gap-3 text-sm font-medium text-dark-200">
                {isDark ? (
                  <SunIcon className="h-5 w-5 text-accent-400" />
                ) : (
                  <MoonIcon className="h-5 w-5 text-accent-400" />
                )}
                {isDark ? t('theme.light') : t('theme.dark')}
              </span>
              <Switch checked={!isDark} onCheckedChange={toggleTheme} />
            </div>
          )}
        </Card>

        <button
          type="button"
          onClick={logout}
          className="flex min-h-12 w-full items-center gap-3 rounded-[var(--bento-radius)] border border-error-500/20 bg-error-500/5 px-4 text-left text-sm font-medium text-error-400 transition-colors hover:bg-error-500/10"
        >
          <LogoutIcon className="h-5 w-5" />
          {t('nav.logout')}
        </button>
      </motion.div>
    </motion.div>
  );
}
