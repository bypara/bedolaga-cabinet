import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  getSubscriptionStatusPresentation,
  type SubscriptionStatusInput,
} from '@/utils/subscriptionStatus';

interface SubscriptionStatusBadgeProps extends SubscriptionStatusInput {
  className?: string;
}

export function SubscriptionStatusBadge({ className, ...status }: SubscriptionStatusBadgeProps) {
  const { t } = useTranslation();
  const presentation = getSubscriptionStatusPresentation(status);

  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none',
        presentation.badgeClassName,
        className,
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', presentation.dotClassName)}
        aria-hidden="true"
      />
      {t(presentation.labelKey, presentation.fallbackLabel)}
    </span>
  );
}
