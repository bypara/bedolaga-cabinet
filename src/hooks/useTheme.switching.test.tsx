// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTheme } from './useTheme';

const { getEnabledThemes } = vi.hoisted(() => ({
  getEnabledThemes: vi.fn(() => Promise.resolve({ dark: true, light: true })),
}));

vi.mock('../api/themeColors', () => ({
  themeColorsApi: { getEnabledThemes },
}));

vi.mock('./useTelegramSDK', () => ({
  getTelegramColorScheme: () => null,
}));

function ThemeProbe({ name }: { name: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" data-testid={name} onClick={toggleTheme}>
      {theme}
    </button>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('light');
  document.documentElement.classList.add('dark');
  document.documentElement.style.removeProperty('color-scheme');
  document.body.style.removeProperty('background-color');
  getEnabledThemes.mockClear();

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterEach(cleanup);

describe('useTheme switching', () => {
  it('updates all consumers and forces the mobile viewport background to repaint', async () => {
    render(
      <>
        <ThemeProbe name="header" />
        <ThemeProbe name="content" />
      </>,
    );

    fireEvent.click(screen.getByTestId('header'));

    await waitFor(() => {
      expect(screen.getByTestId('header').textContent).toBe('light');
      expect(screen.getByTestId('content').textContent).toBe('light');
    });
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.body.style.backgroundColor).toBe('var(--color-light-bg, #f7e7ce)');

    fireEvent.click(screen.getByTestId('content'));

    await waitFor(() => {
      expect(screen.getByTestId('header').textContent).toBe('dark');
      expect(screen.getByTestId('content').textContent).toBe('dark');
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.body.style.backgroundColor).toBe('var(--color-dark-bg, #0a0f1a)');
  });
});
