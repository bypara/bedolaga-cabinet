// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TicketNotificationBell from './TicketNotificationBell';

const { pending } = vi.hoisted(() => ({ pending: new Promise<never>(() => {}) }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru' },
  }),
}));

vi.mock('../store/auth', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ isAuthenticated: true }),
}));

vi.mock('../api/ticketNotifications', () => ({
  ticketNotificationsApi: {
    getUnreadCount: () => Promise.resolve({ unread_count: 0 }),
    getAdminUnreadCount: () => Promise.resolve({ unread_count: 0 }),
    getNotifications: () => pending,
    getAdminNotifications: () => pending,
    markAllAsRead: vi.fn(),
    markAllAdminAsRead: vi.fn(),
    markAsRead: vi.fn(),
    markAdminAsRead: vi.fn(),
  },
}));

vi.mock('../api/news', () => ({
  newsApi: { getNews: () => pending },
}));

vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: () => undefined,
}));

vi.mock('../hooks/useHeaderHeight', () => ({
  useHeaderHeight: () => ({ mobile: 0, isMobileFullscreen: false }),
}));

vi.mock('./Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

afterEach(cleanup);

describe('TicketNotificationBell loading state', () => {
  it('shows one neutral loader instead of notification-shaped placeholders', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TicketNotificationBell />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTitle('Notifications'));

    const loader = screen.getByRole('status');
    expect(loader.className).toContain('animate-spin');
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});
