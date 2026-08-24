import { ChevronRightIcon, RefreshIcon } from '@/components/icons';
import { uiLocale } from '@/utils/uiLocale';
import type { UseMutationResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import ConnectDeviceTile from './ConnectDeviceTile';
import { useTheme } from '../../hooks/useTheme';
import { useTrafficZone } from '../../hooks/useTrafficZone';
import { formatTraffic } from '../../utils/formatTraffic';
import { getGlassColors } from '../../utils/glassTheme';
import type { Subscription } from '../../types';

interface SubscriptionCardActiveProps {
  subscription: Subscription;
  trafficData: {
    traffic_used_gb: number;
    traffic_used_percent: number;
    is_unlimited: boolean;
  } | null;
  refreshTrafficMutation: UseMutationResult<unknown, unknown, void, unknown>;
  trafficRefreshCooldown: number;
  connectedDevices: number;
}

export default function SubscriptionCardActive({
  subscription,
  trafficData,
  refreshTrafficMutation,
  trafficRefreshCooldown,
  connectedDevices,
}: SubscriptionCardActiveProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);

  const usedPercent = trafficData?.traffic_used_percent ?? subscription.traffic_used_percent;
  const usedGb = trafficData?.traffic_used_gb ?? subscription.traffic_used_gb;
  const isUnlimited = trafficData?.is_unlimited ?? subscription.traffic_limit_gb === 0;
  const zone = useTrafficZone(usedPercent);
  const formattedDate = new Date(subscription.end_date).toLocaleDateString(uiLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const daysLeft = subscription.days_left;
  const isExpiringSoon = daysLeft <= 14;

  return (
    <section
      className="relative overflow-hidden rounded-3xl p-5 sm:p-6 lg:backdrop-blur-xl"
      style={{
        background: g.cardBg,
        border: `1px solid ${g.cardBorder}`,
        boxShadow: g.shadow,
      }}
      aria-labelledby="current-subscription-title"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-500/10 px-2.5 py-1 text-[11px] font-semibold text-success-400">
              <span className="h-1.5 w-1.5 rounded-full bg-success-400" aria-hidden="true" />
              {t('subscription.active')}
            </span>
            {subscription.is_trial && (
              <span className="rounded-full bg-accent-500/10 px-2.5 py-1 text-[11px] font-semibold text-accent-400">
                {t('subscription.trialStatus')}
              </span>
            )}
          </div>
          <h2
            id="current-subscription-title"
            className="truncate text-xl font-bold tracking-tight text-dark-50"
          >
            {subscription.tariff_name || t('subscription.currentPlan')}
          </h2>
          <p
            className={`mt-1 text-sm ${isExpiringSoon ? 'text-warning-400' : 'text-dark-400'}`}
          >
            {t('dashboard.activeUntil')} {formattedDate}
            {isExpiringSoon && ` · ${daysLeft} ${t('subscription.daysShort')}`}
          </p>
        </div>

        <Link
          to={`/subscriptions/${subscription.id}`}
          className="flex min-h-10 flex-none items-center gap-1 rounded-xl border border-dark-700/80 px-3 text-xs font-medium text-dark-300 transition-colors hover:border-dark-600 hover:bg-dark-800 hover:text-dark-100"
        >
          {t('dashboard.viewSubscription')}
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ConnectDeviceTile subscription={subscription} connectedDevices={connectedDevices} />

      <div
        className="mt-3 rounded-2xl p-4"
        style={{ background: g.innerBg, border: `1px solid ${g.innerBorder}` }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-dark-400">{t('dashboard.trafficUsageTitle')}</p>
            <p className="mt-1 text-sm font-semibold text-dark-100">
              {isUnlimited
                ? `${formatTraffic(usedGb)} · ${t('dashboard.unlimited')}`
                : `${formatTraffic(usedGb)} / ${formatTraffic(subscription.traffic_limit_gb)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refreshTrafficMutation.mutate()}
            disabled={refreshTrafficMutation.isPending || trafficRefreshCooldown > 0}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-dark-500 transition-colors hover:bg-dark-700/70 hover:text-dark-200 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t('common.refresh')}
            title={trafficRefreshCooldown > 0 ? `${trafficRefreshCooldown}s` : t('common.refresh')}
          >
            <RefreshIcon
              className={`h-4 w-4 ${refreshTrafficMutation.isPending ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        {!isUnlimited && (
          <div
            className="h-2 overflow-hidden rounded-full bg-dark-700/70"
            role="progressbar"
            aria-label={t('dashboard.trafficUsageTitle')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(usedPercent)}
          >
            <div
              className="h-full rounded-full transition-[width,background] duration-500"
              style={{ width: `${Math.min(100, usedPercent)}%`, background: zone.mainVar }}
            />
          </div>
        )}
      </div>

      {isExpiringSoon && (
        <Link
          to="/subscription/purchase"
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-warning-500/15 px-4 text-sm font-semibold text-warning-400 transition-colors hover:bg-warning-500/20"
        >
          {t('subscription.extend')}
        </Link>
      )}
    </section>
  );
}
