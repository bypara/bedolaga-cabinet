import { uiLocale } from '@/utils/uiLocale';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useLocation } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { Subscription } from '../../types';
import { subscriptionApi } from '../../api/subscription';
import { useTheme } from '../../hooks/useTheme';
import { useCurrency } from '../../hooks/useCurrency';
import { useHapticFeedback } from '../../platform/hooks/useHaptic';
import { getGlassColors } from '../../utils/glassTheme';
import { getInsufficientBalanceError } from '../../utils/subscriptionHelpers';
import {
  ChevronRightIcon,
  ClockIcon,
  ExclamationIcon,
  PauseIcon,
  PlusIcon,
  PowerIcon,
  SubscriptionIcon,
} from '@/components/icons';
import { SubscriptionStatusBadge } from '../subscription/SubscriptionStatusBadge';
import { getSubscriptionStatusPresentation } from '../../utils/subscriptionStatus';

interface SubscriptionCardExpiredProps {
  subscription: Subscription;
  balanceKopeks?: number;
  balanceRubles?: number;
  className?: string;
}

export default function SubscriptionCardExpired({
  subscription,
  balanceKopeks = 0,
  balanceRubles = 0,
  className,
}: SubscriptionCardExpiredProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { formatAmount, currencySymbol } = useCurrency();
  const haptic = useHapticFeedback();

  const [isRenewing, setIsRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);

  const formattedDate = new Date(subscription.end_date).toLocaleDateString(uiLocale());

  // Detect limited (traffic exhausted) state
  const isLimited = subscription.is_limited;

  // Detect daily subscription (disabled or expired)
  const isDaily = subscription.is_daily;
  const isDisabledDaily = subscription.status === 'disabled' && isDaily;
  const statusPresentation = getSubscriptionStatusPresentation({
    status: subscription.status,
    isTrial: subscription.is_trial,
    isDaily,
    isDailyPaused: subscription.is_daily_paused,
    isExpired: subscription.is_expired,
    daysLeft: subscription.days_left,
  });
  const isDisabled = statusPresentation.kind === 'disabled';
  const isPaused = statusPresentation.kind === 'paused';

  /*
   * Списывать с баланса прямо из карточки можно только там, где выбирать нечего:
   * суточный тариф стоит один день, а приостановленный просто возобновляется.
   *
   * Обычной подписке период выбирает клиент. Кнопка раньше молча продлевала на
   * 30 дней — то есть решала за него и мимо скидок за длинные периоды (месяц за
   * 600 ₽ против полугода со скидкой). Хуже того, тариф вообще мог не
   * продаваться месяцем: тогда сервер отвечал «период недоступен», и кнопка
   * выглядела сломанной. Теперь она открывает выбор периода текущего тарифа.
   */
  const isInstantRenew = isDisabledDaily || (isDaily && !!subscription.tariff_id);

  // For daily subs, check if balance covers daily price; otherwise 100 kopeks minimum
  const dailyPrice = subscription.daily_price_kopeks ?? 0;
  const hasBalance = isDaily ? balanceKopeks >= dailyPrice && dailyPrice > 0 : balanceKopeks >= 100;

  const handleQuickRenew = async () => {
    setIsRenewing(true);
    setRenewError(null);
    haptic.buttonPressHeavy();

    try {
      if (isDisabledDaily) {
        // Resume daily subscription via toggle pause endpoint
        await subscriptionApi.togglePause(subscription.id);
      } else if (isDaily && subscription.tariff_id) {
        // Expired daily tariff — purchase for 1 day. Pass subscription.id
        // so the backend resolves the EXACT row instead of doing a
        // (user_id, tariff_id) re-lookup that races with concurrent
        // panel webhooks (would surface as "Тариф уже активен" + refund).
        await subscriptionApi.purchaseTariff(subscription.tariff_id, 1, undefined, subscription.id);
      } else {
        // Сюда кнопка не ведёт: обычной подписке период выбирает клиент. Если
        // условия показа когда-нибудь разъедутся, открываем выбор периода, а не
        // списываем месяц молча.
        navigate(`/subscriptions/${subscription.id}/renew`);
        return;
      }
      haptic.success();
      queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'subscription',
      });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
    } catch (err: unknown) {
      haptic.error();
      const insufficientData = getInsufficientBalanceError(err);
      if (insufficientData) {
        setRenewError(t('dashboard.expired.insufficientFunds'));
      } else if (err instanceof AxiosError) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string') {
          setRenewError(detail);
        } else {
          setRenewError(t('dashboard.expired.renewError'));
        }
      } else {
        setRenewError(t('dashboard.expired.renewError'));
      }
    } finally {
      setIsRenewing(false);
    }
  };

  const handleTopUp = () => {
    haptic.buttonPress();
    const params = new URLSearchParams();
    params.set('returnTo', location.pathname);
    navigate(`/balance/top-up?${params.toString()}`);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 ${className ?? ''}`}
      style={{
        background: g.cardBg,
        border: `1px solid ${statusPresentation.borderColor}`,
        boxShadow: g.shadow,
      }}
    >
      {/* Header */}
      <div className="mb-5 flex items-start gap-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px]"
          style={{
            background: statusPresentation.softBackground,
            border: `1px solid ${statusPresentation.borderColor}`,
            color: statusPresentation.textColor,
          }}
        >
          {isLimited ? (
            <ExclamationIcon className="h-[22px] w-[22px]" />
          ) : isPaused ? (
            <PauseIcon className="h-[22px] w-[22px]" />
          ) : isDisabled ? (
            <PowerIcon className="h-[22px] w-[22px]" />
          ) : (
            <ClockIcon className="h-[22px] w-[22px]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <SubscriptionStatusBadge
            status={subscription.status}
            isTrial={subscription.is_trial}
            isDaily={isDaily}
            isDailyPaused={subscription.is_daily_paused}
            isExpired={subscription.is_expired}
            daysLeft={subscription.days_left}
            className="mb-2"
          />
          <h2 className="truncate text-lg font-bold tracking-tight text-dark-50">
            {subscription.tariff_name || t('subscription.currentPlan')}
          </h2>
        </div>
        <Link
          to={`/subscriptions/${subscription.id}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dark-700/80 text-dark-400 transition-colors hover:border-dark-600 hover:bg-dark-800 hover:text-dark-100"
          aria-label={t('dashboard.viewSubscription')}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
      </div>

      {/* Limited description */}
      {(isLimited || isDisabled) && (
        <p className="mb-4 text-sm text-dark-50/60">
          {isLimited
            ? t('subscription.trafficLimitedDescription')
            : t(
                'subscription.disabledDescription',
                'Доступ отключён. Откройте подписку, чтобы проверить настройки.',
              )}
        </p>
      )}

      {/* Subscription term + balance. The status is intentionally not repeated here. */}
      <div
        className="mb-5 grid grid-cols-2 rounded-2xl"
        style={{
          background: g.innerBg,
          border: `1px solid ${g.innerBorder}`,
        }}
      >
        <div className="min-w-0 px-4 py-3.5">
          <div className="text-[11px] font-medium text-dark-400">
            {t('subscription.termLabel', 'Срок подписки')}
          </div>
          <div className="mt-1 truncate text-sm font-semibold tracking-tight text-dark-100">
            {formattedDate}
          </div>
        </div>
        <div className="min-w-0 border-l border-dark-700/60 px-4 py-3.5 text-right">
          <div className="text-[11px] font-medium text-dark-400">
            {t('dashboard.expired.balance')}
          </div>
          <div
            className={`mt-1 truncate text-sm font-semibold ${hasBalance ? 'text-success-400' : 'text-dark-300'}`}
          >
            {formatAmount(balanceRubles)} {currencySymbol}
          </div>
        </div>
      </div>

      {/* Renew error */}
      {renewError && (
        <div
          className="mb-4 rounded-xl border border-error-500/30 bg-error-500/10 p-3 text-center text-sm text-error-400"
          role="alert"
        >
          {renewError}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2.5">
        {isLimited ? (
          <Link
            to={`/subscriptions/${subscription.id}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-[14px] py-3.5 text-[15px] font-semibold tracking-tight text-white transition-all duration-300"
            style={{
              background: 'rgb(var(--color-accent-500))',
              boxShadow: '0 4px 18px rgba(var(--color-accent-500), 0.2)',
            }}
          >
            <PlusIcon className="h-4 w-4" />
            {t('subscription.buyTraffic')}
          </Link>
        ) : isDisabled ? (
          <>
            <Link
              to={`/subscriptions/${subscription.id}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-accent-500 py-3.5 text-[15px] font-semibold tracking-tight text-on-accent transition-colors hover:bg-accent-600"
            >
              {t('subscription.openDetails', 'Подробнее')}
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
            <Link
              to="/subscription/purchase"
              className="flex items-center justify-center rounded-[14px] border border-dark-700 bg-dark-800/60 px-5 py-3.5 text-[15px] font-semibold tracking-tight text-dark-300 transition-colors hover:bg-dark-800 hover:text-dark-100"
            >
              {t('dashboard.expired.tariffs')}
            </Link>
          </>
        ) : (
          <>
            {/* Quick Renew or Top Up button (hidden for expired trials) */}
            {!subscription.is_trial &&
              (!isInstantRenew ? (
                <Link
                  to={`/subscriptions/${subscription.id}/renew`}
                  onClick={() => haptic.buttonPressHeavy()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[14px] py-3.5 text-[15px] font-semibold tracking-tight text-white transition-all duration-300"
                  style={{
                    background: 'rgb(var(--color-accent-500))',
                    boxShadow: '0 4px 18px rgba(var(--color-accent-500), 0.2)',
                  }}
                >
                  <SubscriptionIcon className="h-4 w-4" />
                  {t('dashboard.expired.quickRenew')}
                </Link>
              ) : hasBalance ? (
                <button
                  type="button"
                  onClick={handleQuickRenew}
                  disabled={isRenewing}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[14px] py-3.5 text-[15px] font-semibold tracking-tight text-white transition-all duration-300 disabled:opacity-50"
                  style={{
                    background: 'rgb(var(--color-accent-500))',
                    boxShadow: '0 4px 18px rgba(var(--color-accent-500), 0.2)',
                  }}
                >
                  {isRenewing ? (
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                      aria-hidden="true"
                    />
                  ) : (
                    <SubscriptionIcon className="h-4 w-4" />
                  )}
                  {isRenewing
                    ? t('common.loading')
                    : isDisabledDaily
                      ? t('dashboard.suspended.resume')
                      : t('dashboard.expired.quickRenew')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleTopUp}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[14px] py-3.5 text-[15px] font-semibold tracking-tight text-white transition-all duration-300"
                  style={{
                    background: 'rgb(var(--color-accent-500))',
                    boxShadow: '0 4px 18px rgba(var(--color-accent-500), 0.2)',
                  }}
                >
                  <PlusIcon className="h-4 w-4" />
                  {t('dashboard.expired.topUp')}
                </button>
              ))}

            {/* Tariffs (go to purchase page) — full-width for trials */}
            <Link
              to="/subscription/purchase"
              className={`flex items-center justify-center rounded-[14px] px-5 py-3.5 text-[15px] font-semibold tracking-tight transition-colors duration-200 ${
                subscription.is_trial ? 'flex-1 text-white' : 'text-dark-50/50'
              }`}
              style={
                subscription.is_trial
                  ? {
                      background: 'rgb(var(--color-accent-500))',
                      boxShadow: '0 4px 18px rgba(var(--color-accent-500), 0.2)',
                    }
                  : {
                      background: g.innerBg,
                      border: `1px solid ${g.innerBorder}`,
                    }
              }
            >
              {t('dashboard.expired.tariffs')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
