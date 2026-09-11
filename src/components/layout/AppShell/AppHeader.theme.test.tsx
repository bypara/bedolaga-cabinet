// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppHeader } from './AppHeader';

const { toggleTheme } = vi.hoisted(() => ({ toggleTheme: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/api/branding', () => ({
  brandingApi: {
    getBranding: () => Promise.resolve({ name: 'Hunt', logo_letter: 'H' }),
    getLogoUrl: () => null,
  },
  getCachedBranding: () => ({ name: 'Hunt', logo_letter: 'H' }),
  isLogoPreloaded: () => false,
  preloadLogo: () => Promise.resolve(),
  setCachedBranding: vi.fn(),
}));

vi.mock('@/components/TicketNotificationBell', () => ({
  default: () => <button type="button">notifications</button>,
}));

afterEach(() => {
  cleanup();
  toggleTheme.mockClear();
});

describe('AppHeader theme action', () => {
  it('shows the theme switch beside notifications and changes the theme', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AppHeader
            isFullscreen={false}
            safeAreaInset={{ top: 0, bottom: 0, left: 0, right: 0 }}
            contentSafeAreaInset={{ top: 0, bottom: 0, left: 0, right: 0 }}
            isDark
            canToggleTheme
            onToggleTheme={toggleTheme}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const themeButton = await screen.findByRole('button', { name: 'theme.light' });
    expect(themeButton.nextElementSibling?.textContent).toBe('notifications');

    fireEvent.click(themeButton);
    expect(toggleTheme).toHaveBeenCalledOnce();
  });
});
