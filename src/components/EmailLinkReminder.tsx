import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { brandingApi } from '@/api/branding';
import { EmailIcon } from '@/components/icons';
import { useAuthStore } from '@/store/auth';
import { safeLocal } from '@/utils/safeStorage';

const REMINDER_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

const reminderKey = (userId: number) => `email-link-reminder-v1-until:${userId}`;

export default function EmailLinkReminder() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const [, forceStorageRefresh] = useState(0);

  const { data: emailAuthConfig } = useQuery({
    queryKey: ['email-auth-enabled'],
    queryFn: brandingApi.getEmailAuthEnabled,
    enabled: Boolean(user && !user.email),
    staleTime: 60_000,
  });

  if (!user || user.email || emailAuthConfig?.enabled !== true) return null;

  const dismissedUntil = Number(safeLocal.getItem(reminderKey(user.id)) ?? 0);
  if (Number.isFinite(dismissedUntil) && dismissedUntil > Date.now()) return null;

  const remindLater = () => {
    safeLocal.setItem(reminderKey(user.id), String(Date.now() + REMINDER_DELAY_MS));
    forceStorageRefresh((value) => value + 1);
  };

  return (
    <aside
      aria-label={t('dashboard.emailReminder.title')}
      className="flex flex-col gap-3 rounded-2xl border border-accent-500/20 bg-accent-500/[0.06] p-3.5 sm:flex-row sm:items-center sm:p-4"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-accent-500/12 text-accent-400">
          <EmailIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-dark-100">
            {t('dashboard.emailReminder.title')}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-dark-400">
            {t('dashboard.emailReminder.description')}
          </p>
        </div>
      </div>
      <div className="flex flex-none items-center gap-2 pl-12 sm:pl-0">
        <button
          type="button"
          onClick={remindLater}
          className="rounded-lg px-3 py-2 text-xs font-medium text-dark-400 transition-colors hover:bg-dark-800 hover:text-dark-200"
        >
          {t('dashboard.emailReminder.later')}
        </button>
        <Link
          to="/profile/accounts"
          className="rounded-lg bg-accent-500 px-3 py-2 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-600"
        >
          {t('dashboard.emailReminder.action')}
        </Link>
      </div>
    </aside>
  );
}
