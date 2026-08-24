import { useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { infoApi } from '../api/info';
import { subscriptionApi } from '../api/subscription';
import PageLoader from './common/PageLoader';
import LegalFooter from './LegalFooter';
import { getApiErrorMessage } from '../utils/api-error';
import { CheckIcon, ShieldIcon, SparklesIcon } from '@/components/icons';

interface LegalOnboardingGateProps {
  children: ReactNode;
}

const OFFER = 'public_offer';
const PRIVACY = 'privacy_policy';

function LegalDocumentLink({ to, children }: { to: string; children?: ReactNode }) {
  return (
    <a
      href={to}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-accent-400 underline decoration-accent-400/40 underline-offset-2 transition-colors hover:text-accent-300"
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </a>
  );
}

export default function LegalOnboardingGate({ children }: LegalOnboardingGateProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [consentSaved, setConsentSaved] = useState(false);
  const consentRecordedRef = useRef(false);

  const consentQuery = useQuery({
    queryKey: ['legal-consent-status', i18n.language],
    queryFn: () => infoApi.getLegalConsentStatus(i18n.language),
    staleTime: 60_000,
    retry: 2,
  });

  const needsConsent =
    consentQuery.data?.required === true && consentQuery.data.has_accepted_all === false;

  const trialQuery = useQuery({
    queryKey: ['trial-info'],
    queryFn: () => subscriptionApi.getTrialInfo(),
    enabled: needsConsent,
    staleTime: 30_000,
    retry: false,
  });

  const finishOnboarding = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['legal-consent-status'] }),
      queryClient.invalidateQueries({ queryKey: ['trial-info'] }),
      queryClient.invalidateQueries({ queryKey: ['subscription'] }),
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] }),
      queryClient.invalidateQueries({ queryKey: ['balance'] }),
    ]);
  };

  const acceptMutation = useMutation({
    mutationFn: async ({ activateTrial }: { activateTrial: boolean }) => {
      setActionError(null);
      consentRecordedRef.current = false;
      await infoApi.acceptLegalConsent(consentQuery.data?.documents ?? [], i18n.language);
      consentRecordedRef.current = true;
      setConsentSaved(true);
      if (activateTrial) await subscriptionApi.activateTrial();
    },
    onSuccess: finishOnboarding,
    onError: (error) => {
      setActionError(
        getApiErrorMessage(
          error,
          consentRecordedRef.current
            ? t(
                'legalOnboarding.trialFailed',
                'Согласие сохранено, но триал не активировался. Можно продолжить без него.',
              )
            : t(
                'legalOnboarding.acceptFailed',
                'Не удалось сохранить согласие. Повторите попытку.',
              ),
        ),
      );
    },
  });

  if (consentQuery.isLoading) return <PageLoader variant="dark" />;

  if (consentQuery.isError) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-4 py-8">
        <div className="card w-full max-w-md p-6 text-center">
          <ShieldIcon className="mx-auto mb-4 h-8 w-8 text-warning-400" />
          <h1 className="text-xl font-bold text-dark-50">
            {t('legalOnboarding.loadErrorTitle', 'Не удалось проверить документы')}
          </h1>
          <p className="mt-2 text-sm text-dark-400">
            {t(
              'legalOnboarding.loadErrorText',
              'Обновите страницу или повторите попытку — без проверки мы не можем продолжить.',
            )}
          </p>
          <button className="btn-primary mt-5 w-full" onClick={() => consentQuery.refetch()}>
            {t('common.retry', 'Повторить')}
          </button>
        </div>
      </div>
    );
  }

  if (!needsConsent) return <>{children}</>;

  const documents = consentQuery.data?.documents ?? [];
  const hasOffer = documents.includes(OFFER);
  const hasPrivacy = documents.includes(PRIVACY);
  const trial = trialQuery.data;
  const trialAvailable = trial?.is_available === true;
  const isPending = acceptMutation.isPending;
  const canSubmit = (checked || consentSaved) && !isPending;

  return (
    <div className="flex min-h-[100dvh] flex-col px-4 py-6 sm:justify-center sm:py-10">
      <main className="mx-auto w-full max-w-lg">
        <div className="card overflow-hidden p-0">
          <div className="border-b border-dark-700/70 bg-dark-900/50 px-5 py-6 text-center sm:px-8 sm:py-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-accent-500/25 bg-accent-500/10 text-accent-400">
              {trialAvailable ? (
                <SparklesIcon className="h-6 w-6" />
              ) : (
                <ShieldIcon className="h-6 w-6" />
              )}
            </div>
            <h1 className="mt-4 text-2xl font-bold text-dark-50">
              {t('legalOnboarding.title', 'Добро пожаловать!')}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-dark-400">
              {trialAvailable
                ? t(
                    'legalOnboarding.subtitleWithTrial',
                    'Попробуйте сервис и познакомьтесь с возможностями кабинета.',
                  )
                : t(
                    'legalOnboarding.subtitle',
                    'Перед началом подтвердите согласие с обязательными документами.',
                  )}
            </p>
          </div>

          <div className="space-y-5 px-5 py-5 sm:px-8 sm:py-7">
            {trialAvailable && trial && (
              <section className="rounded-2xl border border-accent-500/20 bg-accent-500/[0.06] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-dark-100">
                      {trial.requires_payment
                        ? t('legalOnboarding.paidTrialTitle', 'Пробный доступ')
                        : t('legalOnboarding.freeTrialTitle', 'Бесплатный пробный период')}
                    </h2>
                    <p className="mt-0.5 text-xs text-dark-400">
                      {trial.requires_payment
                        ? t('legalOnboarding.paidTrialPrice', {
                            price: trial.price_rubles,
                            defaultValue: 'Активация — {{price}} ₽',
                          })
                        : t('legalOnboarding.freeTrialPrice', 'Без оплаты и обязательств')}
                    </p>
                  </div>
                  <span className="rounded-full bg-accent-500/15 px-3 py-1 text-xs font-semibold text-accent-400">
                    {t('legalOnboarding.days', {
                      count: trial.duration_days,
                      defaultValue: '{{count}} дн.',
                    })}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-dark-900/60 px-3 py-2.5 text-dark-300">
                    <span className="font-semibold text-dark-100">
                      {trial.traffic_limit_gb === 0 ? '∞' : trial.traffic_limit_gb}
                    </span>{' '}
                    {t('common.units.gb')}
                  </div>
                  <div className="rounded-xl bg-dark-900/60 px-3 py-2.5 text-dark-300">
                    <span className="font-semibold text-dark-100">
                      {trial.device_limit === 0 ? '∞' : trial.device_limit}
                    </span>{' '}
                    {t('subscription.trial.devices')}
                  </div>
                </div>
              </section>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-dark-700 bg-dark-900/50 p-4 transition-colors hover:border-dark-600">
              <input
                type="checkbox"
                checked={checked || consentSaved}
                disabled={isPending || consentSaved}
                onChange={(event) => setChecked(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-dark-600 bg-dark-800 text-accent-500 focus:ring-accent-500"
              />
              <span className="text-sm leading-relaxed text-dark-300">
                {hasOffer && hasPrivacy ? (
                  <Trans
                    i18nKey="legalOnboarding.agreementBoth"
                    defaults="Я принимаю условия <offer>Публичной оферты</offer> и подтверждаю, что ознакомился(-ась) с <privacy>Политикой конфиденциальности</privacy>."
                    components={{
                      offer: <LegalDocumentLink to="/offer" />,
                      privacy: <LegalDocumentLink to="/privacy" />,
                    }}
                  />
                ) : hasOffer ? (
                  <Trans
                    i18nKey="legalOnboarding.agreementOffer"
                    defaults="Я принимаю условия <offer>Публичной оферты</offer>."
                    components={{ offer: <LegalDocumentLink to="/offer" /> }}
                  />
                ) : (
                  <Trans
                    i18nKey="legalOnboarding.agreementPrivacy"
                    defaults="Я подтверждаю, что ознакомился(-ась) с <privacy>Политикой конфиденциальности</privacy>."
                    components={{ privacy: <LegalDocumentLink to="/privacy" /> }}
                  />
                )}
              </span>
            </label>

            {consentSaved && (
              <div className="flex items-center gap-2 rounded-xl border border-success-500/20 bg-success-500/10 px-3 py-2.5 text-sm text-success-400">
                <CheckIcon className="h-4 w-4" />
                {t('legalOnboarding.consentSaved', 'Согласие сохранено')}
              </div>
            )}

            {actionError && (
              <div
                className="rounded-xl border border-error-500/25 bg-error-500/10 p-3 text-sm text-error-400"
                role="alert"
              >
                {actionError}
              </div>
            )}

            <div className="space-y-2.5">
              {trialAvailable && !consentSaved && (
                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={!canSubmit}
                  onClick={() => acceptMutation.mutate({ activateTrial: true })}
                >
                  {isPending
                    ? t('common.loading')
                    : t('legalOnboarding.acceptAndTrial', 'Принять и активировать пробный период')}
                </button>
              )}
              <button
                type="button"
                className={
                  trialAvailable && !consentSaved ? 'btn-secondary w-full' : 'btn-primary w-full'
                }
                disabled={!canSubmit}
                onClick={() =>
                  consentSaved
                    ? finishOnboarding()
                    : acceptMutation.mutate({ activateTrial: false })
                }
              >
                {isPending
                  ? t('common.loading')
                  : consentSaved
                    ? t('legalOnboarding.continue', 'Продолжить в кабинет')
                    : t('legalOnboarding.acceptAndContinue', 'Принять и продолжить')}
              </button>
            </div>

            <p className="text-center text-xs leading-relaxed text-dark-500">
              {t(
                'legalOnboarding.requiredNotice',
                'Без принятия обязательных документов продолжить использование кабинета нельзя.',
              )}
            </p>
          </div>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}
