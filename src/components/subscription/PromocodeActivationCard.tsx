import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { balanceApi } from '../../api/balance';
import { useAuthStore } from '../../store/auth';
import { Button } from '../primitives/Button';
import { TagIcon } from '../icons';

interface EligibleSubscription {
  id: number;
  tariff_name: string;
  days_left: number;
}

interface PromocodeActivationCardProps {
  subscriptionId?: number;
}

const KNOWN_ERROR_KEYS = new Set([
  'not_found',
  'expired',
  'inactive',
  'not_yet_valid',
  'used',
  'already_used_by_user',
  'active_discount_exists',
  'no_subscription_for_days',
  'subscription_not_found',
  'not_first_purchase',
  'daily_limit',
  'trial_subscription_exists',
  'trial_provisioning_failed',
  'user_not_found',
  'server_error',
]);

export function PromocodeActivationCard({ subscriptionId }: PromocodeActivationCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const [code, setCode] = useState('');
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [eligibleSubscriptions, setEligibleSubscriptions] = useState<EligibleSubscription[] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activate = async (selectedSubscriptionId?: number) => {
    const normalizedCode = (selectedSubscriptionId ? pendingCode : code)?.trim() ?? '';
    if (!normalizedCode) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await balanceApi.activatePromocode(
        normalizedCode,
        selectedSubscriptionId ?? subscriptionId,
      );

      if (result.error === 'select_subscription' && result.eligible_subscriptions?.length) {
        setPendingCode(result.code || normalizedCode);
        setEligibleSubscriptions(result.eligible_subscriptions);
        return;
      }

      if (!result.success) {
        setError(t('balance.promocode.errors.server_error'));
        return;
      }

      setSuccess(result.bonus_description || result.message || t('balance.promocode.success'));
      setCode('');
      setPendingCode(null);
      setEligibleSubscriptions(null);

      await Promise.all([
        refreshUser(),
        queryClient.invalidateQueries({ queryKey: ['balance'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['active-discount'] }),
        queryClient.invalidateQueries({ queryKey: ['purchase-options'] }),
        queryClient.invalidateQueries({ queryKey: ['subscription'] }),
        queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] }),
      ]);
    } catch (activationError: unknown) {
      const detail = (
        activationError as {
          response?: { data?: { detail?: { code?: string } | string } };
        }
      ).response?.data?.detail;
      const responseCode = typeof detail === 'object' && detail ? detail.code : undefined;
      const errorKey =
        responseCode && KNOWN_ERROR_KEYS.has(responseCode) ? responseCode : 'server_error';
      setError(t(`balance.promocode.errors.${errorKey}`));
      setPendingCode(null);
      setEligibleSubscriptions(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-dark-700/50 bg-dark-900/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <TagIcon className="h-4 w-4 text-accent-400" />
        <div>
          <h2 className="text-sm font-semibold text-dark-100">{t('balance.promocode.title')}</h2>
          <p className="mt-0.5 text-xs text-dark-400">{t('subscription.promocode.hint')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setError(null);
            setSuccess(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void activate();
          }}
          placeholder={t('balance.promocode.placeholder')}
          className="input min-w-0 flex-1"
          disabled={loading}
          autoComplete="off"
        />
        <Button
          type="button"
          onClick={() => void activate()}
          disabled={!code.trim()}
          loading={loading}
          className="sm:min-w-32"
        >
          {t('balance.promocode.activate')}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-3 rounded-xl border border-error-500/25 bg-error-500/10 px-3 py-2 text-xs text-error-400"
            role="alert"
          >
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-3 rounded-xl border border-success-500/25 bg-success-500/10 px-3 py-2 text-xs font-medium text-success-400"
            role="status"
          >
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {eligibleSubscriptions && eligibleSubscriptions.length > 0 && (
        <div className="mt-3 space-y-2 rounded-xl border border-accent-500/25 bg-accent-500/[0.07] p-3">
          <p className="text-xs font-medium text-dark-200">
            {t('balance.promocode.selectSubscription')}
          </p>
          {eligibleSubscriptions.map((eligibleSubscription) => (
            <button
              key={eligibleSubscription.id}
              type="button"
              onClick={() => void activate(eligibleSubscription.id)}
              disabled={loading}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-dark-700/60 bg-dark-800/60 px-3 py-2 text-left text-xs transition-colors hover:border-accent-500/35 hover:bg-dark-800 disabled:opacity-50"
            >
              <span className="truncate text-dark-200">{eligibleSubscription.tariff_name}</span>
              <span className="shrink-0 text-dark-400">
                {t('balance.promocode.daysLeft', { count: eligibleSubscription.days_left })}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setPendingCode(null);
              setEligibleSubscriptions(null);
            }}
            className="text-xs text-dark-400 transition-colors hover:text-dark-200"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}
    </section>
  );
}
