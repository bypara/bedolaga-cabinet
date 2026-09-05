import { type CSSProperties, useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { useAuthStore } from '@/store/auth';
import { useHaptic } from '@/platform';
import { useTelegramSDK } from '@/hooks/useTelegramSDK';
import { useHeaderHeight } from '@/hooks/useHeaderHeight';
import { useTheme } from '@/hooks/useTheme';
import { useBranding } from '@/hooks/useBranding';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { themeColorsApi } from '@/api/themeColors';
import { isLogoPreloaded } from '@/api/branding';
import { cn } from '@/lib/utils';
import { safeLocal } from '@/utils/safeStorage';

import WebSocketNotifications from '@/components/WebSocketNotifications';
import CampaignBonusNotifier from '@/components/CampaignBonusNotifier';
import SuccessNotificationModal from '@/components/SuccessNotificationModal';
import { PromptDialogHost } from '@/components/PromptDialogHost';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import TicketNotificationBell from '@/components/TicketNotificationBell';
import {
  SubscriptionIcon,
  GiftIcon,
  HomeIcon,
  CreditCardIcon,
  AgentIcon,
  UserIcon,
  UsersIcon,
  ShieldIcon,
  InfoIcon,
  WheelIcon,
  GamepadIcon,
  ClipboardIcon,
  LogoutIcon,
  SunIcon,
  MoonIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@/components/icons';

import { AppHeader } from './AppHeader';
import { useBackgroundConsumer } from '@/components/backgrounds/BackgroundHost';

interface AppShellProps {
  children: React.ReactNode;
}

const DESKTOP_SIDEBAR_MIN_WIDTH = 80;
const DESKTOP_SIDEBAR_DEFAULT_WIDTH = 256;
const DESKTOP_SIDEBAR_MAX_WIDTH = 360;
const DESKTOP_SIDEBAR_LABEL_WIDTH = 176;

const clampSidebarWidth = (width: number) =>
  Math.min(DESKTOP_SIDEBAR_MAX_WIDTH, Math.max(DESKTOP_SIDEBAR_MIN_WIDTH, width));

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const logout = useAuthStore((state) => state.logout);
  const { isFullscreen, safeAreaInset, contentSafeAreaInset, platform, isMobile } =
    useTelegramSDK();
  const { mobileCss: headerHeight } = useHeaderHeight();
  const haptic = useHaptic();
  const { toggleTheme, isDark } = useTheme();

  // Extracted hooks
  const { appName, logoLetter, hasCustomLogo, logoUrl } = useBranding();
  const { referralEnabled, wheelEnabled, hasContests, hasPolls, giftEnabled } = useFeatureFlags();
  useScrollRestoration();
  // Анимированный фон рендерит BackgroundHost в App (не перемонтируется при
  // смене роута) — здесь только регистрируем, что на этом роуте он нужен.
  useBackgroundConsumer();

  // Theme toggle visibility
  const { data: enabledThemes } = useQuery({
    queryKey: ['enabled-themes'],
    queryFn: themeColorsApi.getEnabledThemes,
    staleTime: 1000 * 60 * 5,
  });
  const canToggleTheme = enabledThemes?.dark && enabledThemes?.light;

  // Only apply fullscreen UI adjustments on mobile Telegram (iOS/Android)
  const isMobileFullscreen = isFullscreen && isMobile;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSidebarWidth, setDesktopSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return DESKTOP_SIDEBAR_DEFAULT_WIDTH;
    const savedWidth = Number(safeLocal.getItem('cabinet-desktop-sidebar-width'));
    if (Number.isFinite(savedWidth)) return clampSidebarWidth(savedWidth);
    return safeLocal.getItem('cabinet-desktop-sidebar') === 'collapsed'
      ? DESKTOP_SIDEBAR_MIN_WIDTH
      : DESKTOP_SIDEBAR_DEFAULT_WIDTH;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const desktopSidebarExpanded = desktopSidebarWidth >= DESKTOP_SIDEBAR_LABEL_WIDTH;

  useEffect(() => {
    if (!isResizingSidebar) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth = clampSidebarWidth(event.clientX);
      setDesktopSidebarWidth(nextWidth);
      safeLocal.setItem('cabinet-desktop-sidebar-width', String(nextWidth));
      if (nextWidth >= DESKTOP_SIDEBAR_LABEL_WIDTH) {
        safeLocal.setItem('cabinet-desktop-sidebar-expanded-width', String(nextWidth));
      }
    };
    const handlePointerUp = () => setIsResizingSidebar(false);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizingSidebar]);

  const toggleDesktopSidebar = () => {
    if (desktopSidebarExpanded) {
      safeLocal.setItem('cabinet-desktop-sidebar-expanded-width', String(desktopSidebarWidth));
      safeLocal.setItem('cabinet-desktop-sidebar-width', String(DESKTOP_SIDEBAR_MIN_WIDTH));
      setDesktopSidebarWidth(DESKTOP_SIDEBAR_MIN_WIDTH);
      return;
    }

    const savedExpandedWidth = Number(safeLocal.getItem('cabinet-desktop-sidebar-expanded-width'));
    const nextWidth = Number.isFinite(savedExpandedWidth)
      ? clampSidebarWidth(savedExpandedWidth)
      : DESKTOP_SIDEBAR_DEFAULT_WIDTH;
    setDesktopSidebarWidth(Math.max(DESKTOP_SIDEBAR_LABEL_WIDTH, nextWidth));
    safeLocal.setItem(
      'cabinet-desktop-sidebar-width',
      String(Math.max(DESKTOP_SIDEBAR_LABEL_WIDTH, nextWidth)),
    );
  };

  // Desktop rail owns every user destination. Labels appear as tooltips so the
  // content keeps the full width of the viewport.
  const desktopNav = [
    { path: '/', label: t('nav.dashboard'), icon: HomeIcon },
    { path: '/subscriptions', label: t('nav.subscription'), icon: SubscriptionIcon },
    { path: '/balance', label: t('nav.balance'), icon: CreditCardIcon },
    ...(referralEnabled ? [{ path: '/referral', label: t('nav.referral'), icon: UsersIcon }] : []),
    ...(giftEnabled ? [{ path: '/gift', label: t('nav.gift'), icon: GiftIcon }] : []),
    ...(wheelEnabled ? [{ path: '/wheel', label: t('nav.wheel'), icon: WheelIcon }] : []),
    ...(hasContests ? [{ path: '/contests', label: t('nav.contests'), icon: GamepadIcon }] : []),
    ...(hasPolls ? [{ path: '/polls', label: t('nav.polls'), icon: ClipboardIcon }] : []),
    { path: '/support', label: t('nav.support'), icon: AgentIcon },
    { path: '/info', label: t('nav.info'), icon: InfoIcon },
    { path: '/profile', label: t('nav.profile'), icon: UserIcon },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNavClick = () => {
    haptic.impact('light');
  };

  const renderRailLink = (
    path: string,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    admin = false,
  ) => {
    const active = admin ? location.pathname.startsWith('/admin') : isActive(path);
    return (
      <Link
        key={path}
        to={path}
        onClick={handleNavClick}
        aria-label={label}
        title={label}
        className={cn(
          'relative flex h-11 shrink-0 items-center rounded-xl transition-colors duration-200',
          desktopSidebarExpanded
            ? 'w-full justify-start gap-3 px-3'
            : 'w-11 self-center justify-center',
          active
            ? admin
              ? 'text-warning-300'
              : 'text-on-accent'
            : admin
              ? 'text-warning-500/70 hover:bg-warning-500/10 hover:text-warning-300'
              : 'text-dark-400 hover:bg-dark-800 hover:text-dark-100',
        )}
      >
        {active && (
          <motion.span
            layoutId="desktop-rail-active"
            className={cn(
              'absolute inset-0 rounded-xl shadow-sm',
              admin
                ? 'bg-warning-500/15 ring-1 ring-warning-500/20'
                : 'bg-accent-500 shadow-[0_8px_24px_rgba(var(--color-accent-500),0.22)]',
            )}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
        <Icon className="relative h-5 w-5 shrink-0" />
        {desktopSidebarExpanded && (
          <span className="relative min-w-0 truncate text-sm font-medium">{label}</span>
        )}
      </Link>
    );
  };

  // headerHeight comes from useHeaderHeight() — accounts for TG safe area in fullscreen

  return (
    <div className="min-h-viewport">
      {/* Global components */}
      <WebSocketNotifications />
      <CampaignBonusNotifier />
      <SuccessNotificationModal />
      <PromptDialogHost />

      {/* Desktop navigation rail */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-dark-800 bg-dark-950/95 py-3 lg:flex',
          isResizingSidebar ? 'transition-none' : 'transition-[width] duration-300',
        )}
        style={{ width: desktopSidebarWidth }}
      >
        <div
          className={cn(
            'mb-3 flex h-12 items-center',
            desktopSidebarExpanded ? 'px-3' : 'justify-center',
          )}
        >
          <Link
            to="/"
            onClick={handleNavClick}
            aria-label={appName}
            title={appName}
            className={cn(
              'flex min-w-0 items-center',
              desktopSidebarExpanded ? 'flex-1 gap-3' : 'justify-center',
            )}
          >
            <div className="relative flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-2xl border border-dark-700 bg-dark-800">
              <span
                className={cn(
                  'absolute text-sm font-bold text-accent-400 transition-opacity duration-200',
                  hasCustomLogo && isLogoPreloaded() ? 'opacity-0' : 'opacity-100',
                )}
              >
                {logoLetter}
              </span>
              {hasCustomLogo && logoUrl && (
                <img
                  src={logoUrl}
                  alt={appName || 'Logo'}
                  className={cn(
                    'absolute h-full w-full object-contain transition-opacity duration-200',
                    isLogoPreloaded() ? 'opacity-100' : 'opacity-0',
                  )}
                />
              )}
            </div>
            {desktopSidebarExpanded && (
              <span className="truncate text-sm font-semibold text-dark-100">{appName}</span>
            )}
          </Link>
        </div>

        <button
          type="button"
          onClick={toggleDesktopSidebar}
          className="absolute -right-3 top-6 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-dark-700 bg-dark-900 text-dark-400 shadow-lg transition-colors hover:text-dark-100"
          aria-label={desktopSidebarExpanded ? 'Свернуть меню' : 'Развернуть меню'}
          title={desktopSidebarExpanded ? 'Свернуть меню' : 'Развернуть меню'}
        >
          {desktopSidebarExpanded ? (
            <ChevronLeftIcon className="h-4 w-4" />
          ) : (
            <ChevronRightIcon className="h-4 w-4" />
          )}
        </button>

        <div
          role="separator"
          aria-label="Изменить ширину меню"
          aria-orientation="vertical"
          aria-valuemin={DESKTOP_SIDEBAR_MIN_WIDTH}
          aria-valuemax={DESKTOP_SIDEBAR_MAX_WIDTH}
          aria-valuenow={desktopSidebarWidth}
          onPointerDown={(event) => {
            event.preventDefault();
            setIsResizingSidebar(true);
          }}
          className="group absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none"
        >
          <span
            className={cn(
              'absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-accent-500 transition-opacity',
              isResizingSidebar ? 'opacity-100' : 'opacity-0 group-hover:opacity-70',
            )}
          />
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 py-1">
          {desktopNav.map((item) => renderRailLink(item.path, item.label, item.icon))}
          {isAdmin && (
            <>
              <div className="my-1 h-px w-full shrink-0 bg-dark-800" />
              {renderRailLink('/admin', t('admin.nav.title'), ShieldIcon, true)}
            </>
          )}
        </nav>

        <div className="mt-2 flex flex-col gap-1 border-t border-dark-800 px-3 pt-2">
          <TicketNotificationBell
            isAdmin={location.pathname.startsWith('/admin')}
            sidebar
            expanded={desktopSidebarExpanded}
          />
          <button
            onClick={() => {
              haptic.impact('light');
              toggleTheme();
            }}
            className={cn(
              'flex h-11 w-full items-center rounded-xl text-dark-400 transition-colors hover:bg-dark-800 hover:text-accent-400',
              desktopSidebarExpanded ? 'justify-start gap-3 px-3' : 'justify-center',
              !canToggleTheme && 'hidden',
            )}
            aria-label={isDark ? t('theme.light') : t('theme.dark')}
            title={isDark ? t('theme.light') : t('theme.dark')}
          >
            {isDark ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
            {desktopSidebarExpanded && (
              <span className="text-sm font-medium">
                {isDark ? t('theme.light') : t('theme.dark')}
              </span>
            )}
          </button>
          <LanguageSwitcher sidebar expanded={desktopSidebarExpanded} />
          <button
            onClick={() => {
              haptic.impact('light');
              logout();
            }}
            className={cn(
              'flex h-11 w-full items-center rounded-xl text-dark-400 transition-colors hover:bg-error-500/10 hover:text-error-400',
              desktopSidebarExpanded ? 'justify-start gap-3 px-3' : 'justify-center',
            )}
            aria-label={t('nav.logout')}
            title={t('nav.logout')}
          >
            <LogoutIcon className="h-5 w-5" />
            {desktopSidebarExpanded && (
              <span className="text-sm font-medium">{t('nav.logout')}</span>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <AppHeader
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onCommandPaletteOpen={() => {}}
        headerHeight={headerHeight}
        isFullscreen={isMobileFullscreen}
        safeAreaInset={safeAreaInset}
        contentSafeAreaInset={contentSafeAreaInset}
        telegramPlatform={platform}
        hasContests={hasContests}
        hasPolls={hasPolls}
        giftEnabled={giftEnabled}
      />

      {/* Mobile spacer */}
      <div className="lg:hidden" style={{ height: headerHeight }} />

      {/* Main content centered inside the area that remains beside the sidebar */}
      <div
        className={cn(
          'lg:ml-[var(--desktop-sidebar-width)]',
          isResizingSidebar ? 'transition-none' : 'transition-[margin-left] duration-300',
        )}
        style={{ '--desktop-sidebar-width': `${desktopSidebarWidth}px` } as CSSProperties}
      >
        <main className="mx-auto max-w-6xl py-6 pb-8 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
