import { ChevronRightIcon } from '@/components/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useHaptic } from '../../platform';

interface ConnectDeviceTileProps {
  subscription: {
    id: number;
    device_limit: number;
    subscription_url?: string | null;
  };
  connectedDevices: number;
}

export default function ConnectDeviceTile({
  subscription,
  connectedDevices,
}: ConnectDeviceTileProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const haptic = useHaptic();
  const isAtDeviceLimit =
    subscription.device_limit > 0 && connectedDevices >= subscription.device_limit;
  const isFirstDevice = connectedDevices === 0 && !isAtDeviceLimit;

  if (!subscription.subscription_url) return null;

  return (
    <button
      type="button"
      disabled={isAtDeviceLimit}
      onClick={() => {
        if (isAtDeviceLimit) {
          haptic.notification('error');
          return;
        }
        haptic.impact('light');
        navigate(`/connection?sub=${subscription.id}`);
      }}
      className={`flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
        isFirstDevice
          ? 'bg-accent-500 text-on-accent shadow-[0_10px_28px_rgba(var(--color-accent-500),0.22)] hover:bg-accent-600'
          : 'border border-dark-700 bg-dark-800/60 text-dark-100 hover:border-dark-600 hover:bg-dark-800'
      }`}
      data-onboarding="connect-devices"
    >
      <span
        className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${
          isFirstDevice ? 'bg-white/15' : 'bg-accent-500/10 text-accent-400'
        }`}
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M12 17v4M8 21h8M12 8v4M10 10h4" />
        </svg>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{t('dashboard.connectDevice')}</span>
        <span
          className={`mt-0.5 block text-xs ${isFirstDevice ? 'text-white/70' : 'text-dark-500'}`}
        >
          {subscription.device_limit === 0
            ? t('dashboard.devicesConnectedUnlimited', { used: connectedDevices })
            : t('dashboard.devicesOfMax', {
                used: connectedDevices,
                max: subscription.device_limit,
              })}
        </span>
        {isAtDeviceLimit && (
          <span className="mt-1 block text-xs text-warning-400">
            {t('dashboard.deviceLimitReached')}
          </span>
        )}
      </span>

      {!isAtDeviceLimit && <ChevronRightIcon className="h-4 w-4 flex-none opacity-70" />}
    </button>
  );
}
