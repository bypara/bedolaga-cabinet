import { useTranslation } from 'react-i18next';

/**
 * Отметка периода, выбранного оператором как самый выгодный.
 *
 * Плашка врезана в верхнюю границу карточки и не навязывает конкретную
 * пиктограмму: подпись полностью задаётся переводом/настройкой проекта.
 */
export function BestValueBadge({
  className,
  side = 'right',
}: {
  className?: string;
  side?: 'left' | 'right';
}) {
  const { t } = useTranslation();

  return (
    <span
      className={`pointer-events-none absolute top-0 z-10 -translate-y-1/2 whitespace-nowrap rounded-full border border-accent-400/40 bg-dark-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-300 shadow-sm light:bg-champagne-100 ${
        side === 'left' ? 'left-4' : 'right-4'
      } ${className ?? ''}`}
    >
      {t('subscription.bestValue')}
    </span>
  );
}

/** Цвет рамки выделенного периода — тот же токен, что и у отметки. */
export const BEST_VALUE_BORDER = 'rgb(var(--color-accent-400))';
