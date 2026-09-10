import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { getGlassColors } from '../../utils/glassTheme';
import { useHaptic } from '../../platform';
import { CalendarIcon, CheckIcon, ChevronRightIcon, DevicesIcon } from '@/components/icons';
import type { SubscriptionListItem } from '../../types';
import { connectFooterState } from './connectFooterState';
import { SubscriptionConnectFooter } from './SubscriptionConnectFooter';
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge';
import { getSubscriptionStatusPresentation } from '../../utils/subscriptionStatus';

function formatDate(iso: string | null, locale?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(locale ?? undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function SubscriptionListCard({
  subscription,
  onClick,
  connect,
}: {
  subscription: SubscriptionListItem;
  onClick: () => void;
  /**
   * Подключение устройства прямо из карточки. Задаётся только на главной:
   * список «Все подписки» остаётся простым перечнем без действий.
   */
  connect?: {
    /** `undefined`, пока число устройств не загрузилось. */
    connectedDevices: number | undefined;
    onConnect: () => void;
    onManage: () => void;
  };
}) {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const { impact } = useHaptic();

  const handleClick = () => {
    impact('light');
    onClick();
  };

  const isTrial = subscription.is_trial;
  const isActive =
    subscription.status === 'active' ||
    subscription.status === 'trial' ||
    subscription.status === 'limited';
  const statusPresentation = getSubscriptionStatusPresentation({
    status: subscription.status,
    isTrial,
    isDaily: subscription.is_daily,
    isDailyPaused: subscription.is_daily_paused,
    endDate: subscription.end_date,
  });
  const trafficLimit = subscription.traffic_limit_gb;
  const trafficUsed = subscription.traffic_used_gb;
  const isUnlimited = trafficLimit === 0;
  const trafficPercent = isUnlimited
    ? 0
    : trafficLimit > 0
      ? Math.min(100, (trafficUsed / trafficLimit) * 100)
      : 0;
  const trafficColor =
    trafficPercent >= 90
      ? 'bg-error-400'
      : trafficPercent >= 70
        ? 'bg-warning-400'
        : 'bg-success-400';

  const borderColor =
    statusPresentation.kind === 'active' ? g.cardBorder : statusPresentation.borderColor;

  const footer = connect
    ? connectFooterState({
        status: subscription.status,
        subscriptionUrl: subscription.subscription_url,
        deviceLimit: subscription.device_limit,
        connected: connect.connectedDevices,
      })
    : { kind: 'hidden' as const };

  // Подвал — своя зона нажатия, поэтому карточка снаружи не `<button>`:
  // вложенные кнопки невалидны и ведут себя в браузерах непредсказуемо.
  return (
    <div
      className="overflow-hidden rounded-2xl border transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
      style={{ background: g.cardBg, borderColor }}
    >
      <button onClick={handleClick} className="w-full p-4 text-left">
        {/* Header: tariff name + status badge + chevron */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <span className="truncate text-base font-semibold" style={{ color: g.text }}>
              {subscription.tariff_name || t('subscription.defaultName', 'Подписка')}
            </span>
            <SubscriptionStatusBadge
              status={subscription.status}
              isTrial={isTrial}
              isDaily={subscription.is_daily}
              isDailyPaused={subscription.is_daily_paused}
              endDate={subscription.end_date}
              className="shrink-0"
            />
          </div>
          <ChevronRightIcon className="h-4 w-4 shrink-0 opacity-30" />
        </div>

        {/* Traffic mini progress bar */}
        {isActive && (
          <div className="mt-3">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[11px] font-medium" style={{ color: g.textSecondary }}>
                {t('subscription.traffic', 'Трафик')}
              </span>
              <span className="text-[11px] tabular-nums" style={{ color: g.textSecondary }}>
                {isUnlimited
                  ? '∞'
                  : `${trafficUsed.toFixed(1)} / ${trafficLimit} ${t('common.units.gb', 'ГБ')}`}
              </span>
            </div>
            {!isUnlimited && (
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: g.innerBg }}>
                <div
                  className={`h-full rounded-full transition-all ${trafficColor}`}
                  style={{ width: `${Math.max(1, trafficPercent)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Stats row */}
        <div
          className="mt-2.5 flex items-center gap-4 text-[12px]"
          style={{ color: g.textSecondary }}
        >
          {footer.kind === 'hidden' && (
            <span className="flex items-center gap-1">
              <DevicesIcon className="h-3.5 w-3.5 opacity-50" />
              {subscription.device_limit}
            </span>
          )}
          <span className="flex items-center gap-1">
            <CalendarIcon className="h-3.5 w-3.5 opacity-50" />
            {formatDate(subscription.end_date, i18n.language)}
          </span>
          {!isTrial &&
            (() => {
              const isDaily = subscription.is_daily;
              const enabled = isDaily
                ? !subscription.is_daily_paused
                : subscription.autopay_enabled;
              const label = isDaily
                ? t('subscription.dailyAutoCharge', 'Автосписание')
                : t('subscription.autopay', 'Автопродление');
              return (
                <span
                  className={`flex items-center gap-1 ${enabled ? 'text-success-400' : 'text-error-400'}`}
                >
                  {enabled ? (
                    <CheckIcon className="h-3 w-3" />
                  ) : (
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {label}
                </span>
              );
            })()}
        </div>
      </button>

      <SubscriptionConnectFooter
        state={footer}
        borderColor={borderColor}
        mutedColor={g.textSecondary}
        onConnect={() => connect?.onConnect()}
        onManage={() => connect?.onManage()}
      />
    </div>
  );
}
