import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { usePlatform } from '@/platform';

// Icons
import {
  AgentIcon,
  GiftIcon,
  HomeIcon,
  InfoIcon,
  SubscriptionIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
  WheelIcon,
} from './icons';

interface MobileBottomNavProps {
  isKeyboardOpen: boolean;
  referralEnabled?: boolean;
  wheelEnabled?: boolean;
  giftEnabled?: boolean;
}

export function MobileBottomNav({
  isKeyboardOpen,
  referralEnabled,
  wheelEnabled,
  giftEnabled,
}: MobileBottomNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { haptic } = usePlatform();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  // Icon-only navigation leaves enough room to keep every primary destination
  // visible, including both Wheel and Referral when both features are enabled.
  const coreItems = [
    { path: '/', label: t('nav.dashboard'), icon: HomeIcon },
    { path: '/subscriptions', label: t('nav.subscription'), icon: SubscriptionIcon },
    { path: '/balance', label: t('nav.balance'), icon: WalletIcon },
    ...(wheelEnabled ? [{ path: '/wheel', label: t('nav.wheel'), icon: WheelIcon }] : []),
    ...(referralEnabled ? [{ path: '/referral', label: t('nav.referral'), icon: UsersIcon }] : []),
    { path: '/support', label: t('nav.support'), icon: AgentIcon },
    ...(giftEnabled ? [{ path: '/gift', label: t('nav.gift'), icon: GiftIcon }] : []),
    { path: '/info', label: t('nav.info'), icon: InfoIcon },
    { path: '/profile', label: t('nav.profile'), icon: UserIcon },
  ];

  const handleNavClick = () => {
    haptic.impact('light');
  };

  return (
    <nav
      className={cn(
        'fixed bottom-3 left-3 right-3 z-50 mx-auto max-w-xl rounded-full border border-dark-700 bg-dark-900 p-1.5 shadow-[0_14px_42px_rgba(0,0,0,0.48)] transition-all duration-200 lg:hidden',
        isKeyboardOpen
          ? 'pointer-events-none translate-y-4 opacity-0'
          : 'translate-y-0 opacity-100',
      )}
      style={{
        bottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="flex items-center">
        {coreItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
            aria-label={item.label}
            title={item.label}
            className={cn(
              'relative flex h-12 min-w-0 flex-1 items-center justify-center rounded-full transition-colors duration-200',
              isActive(item.path)
                ? 'text-on-accent'
                : 'text-dark-300 hover:bg-dark-800 hover:text-dark-100',
            )}
          >
            {isActive(item.path) && (
              <motion.span
                layoutId="bottom-nav-active"
                className="absolute inset-0 rounded-full bg-accent-500 shadow-[0_8px_24px_rgba(var(--color-accent-500),0.3)]"
                transition={{ type: 'spring', stiffness: 500, damping: 34 }}
              />
            )}
            <item.icon className="relative z-10 h-[21px] w-[21px]" />
          </Link>
        ))}
      </div>
    </nav>
  );
}
