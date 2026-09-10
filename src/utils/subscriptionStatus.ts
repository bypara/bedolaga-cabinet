export type SubscriptionStatusKind =
  | 'active'
  | 'trial'
  | 'expiring'
  | 'limited'
  | 'paused'
  | 'disabled'
  | 'expired'
  | 'trialExpired'
  | 'pending'
  | 'inactive';

export interface SubscriptionStatusInput {
  status?: string | null;
  isTrial?: boolean;
  isDaily?: boolean;
  isDailyPaused?: boolean;
  isExpired?: boolean;
  daysLeft?: number;
  endDate?: string | null;
}

export interface SubscriptionStatusPresentation {
  kind: SubscriptionStatusKind;
  labelKey: string;
  fallbackLabel: string;
  dotClassName: string;
  badgeClassName: string;
  borderColor: string;
  softBackground: string;
  textColor: string;
}

const presentations: Record<
  SubscriptionStatusKind,
  Omit<SubscriptionStatusPresentation, 'kind'>
> = {
  active: {
    labelKey: 'subscription.statusActive',
    fallbackLabel: 'Активна',
    dotClassName: 'bg-success-400',
    badgeClassName: 'border-success-500/20 bg-success-500/10 text-success-400',
    borderColor: 'rgba(var(--color-success-400), 0.16)',
    softBackground: 'rgba(var(--color-success-400), 0.1)',
    textColor: 'rgb(var(--color-success-400))',
  },
  trial: {
    labelKey: 'subscription.statusTrial',
    fallbackLabel: 'Пробный период',
    dotClassName: 'bg-accent-400',
    badgeClassName: 'border-accent-500/20 bg-accent-500/10 text-accent-400',
    borderColor: 'rgba(var(--color-accent-400), 0.18)',
    softBackground: 'rgba(var(--color-accent-400), 0.1)',
    textColor: 'rgb(var(--color-accent-400))',
  },
  expiring: {
    labelKey: 'subscription.statusExpiring',
    fallbackLabel: 'Скоро закончится',
    dotClassName: 'bg-warning-400',
    badgeClassName: 'border-warning-500/20 bg-warning-500/10 text-warning-400',
    borderColor: 'rgba(var(--color-warning-400), 0.2)',
    softBackground: 'rgba(var(--color-warning-400), 0.1)',
    textColor: 'rgb(var(--color-warning-400))',
  },
  limited: {
    labelKey: 'subscription.statusLimited',
    fallbackLabel: 'Трафик закончился',
    dotClassName: 'bg-warning-400',
    badgeClassName: 'border-warning-500/20 bg-warning-500/10 text-warning-400',
    borderColor: 'rgba(var(--color-warning-400), 0.2)',
    softBackground: 'rgba(var(--color-warning-400), 0.1)',
    textColor: 'rgb(var(--color-warning-400))',
  },
  paused: {
    labelKey: 'subscription.statusPaused',
    fallbackLabel: 'Приостановлена',
    dotClassName: 'bg-warning-400',
    badgeClassName: 'border-warning-500/20 bg-warning-500/10 text-warning-400',
    borderColor: 'rgba(var(--color-warning-400), 0.2)',
    softBackground: 'rgba(var(--color-warning-400), 0.1)',
    textColor: 'rgb(var(--color-warning-400))',
  },
  disabled: {
    labelKey: 'subscription.statusDisabled',
    fallbackLabel: 'Отключена',
    dotClassName: 'bg-dark-400',
    badgeClassName: 'border-dark-600/70 bg-dark-700/50 text-dark-300',
    borderColor: 'rgba(var(--color-dark-400), 0.18)',
    softBackground: 'rgba(var(--color-dark-400), 0.1)',
    textColor: 'rgb(var(--color-dark-300))',
  },
  expired: {
    labelKey: 'subscription.statusExpired',
    fallbackLabel: 'Истекла',
    dotClassName: 'bg-error-400',
    badgeClassName: 'border-error-500/20 bg-error-500/10 text-error-400',
    borderColor: 'rgba(var(--color-error-400), 0.18)',
    softBackground: 'rgba(var(--color-error-400), 0.1)',
    textColor: 'rgb(var(--color-error-400))',
  },
  trialExpired: {
    labelKey: 'subscription.statusTrialExpired',
    fallbackLabel: 'Пробный период истёк',
    dotClassName: 'bg-error-400',
    badgeClassName: 'border-error-500/20 bg-error-500/10 text-error-400',
    borderColor: 'rgba(var(--color-error-400), 0.18)',
    softBackground: 'rgba(var(--color-error-400), 0.1)',
    textColor: 'rgb(var(--color-error-400))',
  },
  pending: {
    labelKey: 'subscription.statusPending',
    fallbackLabel: 'Активируется',
    dotClassName: 'bg-accent-400',
    badgeClassName: 'border-accent-500/20 bg-accent-500/10 text-accent-400',
    borderColor: 'rgba(var(--color-accent-400), 0.18)',
    softBackground: 'rgba(var(--color-accent-400), 0.1)',
    textColor: 'rgb(var(--color-accent-400))',
  },
  inactive: {
    labelKey: 'subscription.statusInactive',
    fallbackLabel: 'Неактивна',
    dotClassName: 'bg-dark-400',
    badgeClassName: 'border-dark-600/70 bg-dark-700/50 text-dark-300',
    borderColor: 'rgba(var(--color-dark-400), 0.18)',
    softBackground: 'rgba(var(--color-dark-400), 0.1)',
    textColor: 'rgb(var(--color-dark-300))',
  },
};

function daysUntil(endDate?: string | null): number | undefined {
  if (!endDate) return undefined;
  const timestamp = new Date(endDate).getTime();
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 86_400_000));
}

export function resolveSubscriptionStatus(input: SubscriptionStatusInput): SubscriptionStatusKind {
  const status = input.status?.toLowerCase();
  const isTrial = input.isTrial === true || status === 'trial';

  if (status === 'limited') return 'limited';

  if (status === 'disabled') {
    return input.isDaily || input.isDailyPaused ? 'paused' : 'disabled';
  }

  if (input.isExpired || status === 'expired') {
    return isTrial ? 'trialExpired' : 'expired';
  }

  if (input.isDailyPaused) return 'paused';
  if (isTrial) return 'trial';
  if (status === 'pending') return 'pending';

  if (status === 'active') {
    const daysLeft = input.daysLeft ?? daysUntil(input.endDate);
    return daysLeft !== undefined && daysLeft <= 14 ? 'expiring' : 'active';
  }

  return 'inactive';
}

export function getSubscriptionStatusPresentation(
  input: SubscriptionStatusInput,
): SubscriptionStatusPresentation {
  const kind = resolveSubscriptionStatus(input);
  return { kind, ...presentations[kind] };
}
