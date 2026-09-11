import { useState, useEffect, useCallback, useRef } from 'react';
import { type EnabledThemes, DEFAULT_ENABLED_THEMES } from '../types/theme';
import { themeColorsApi } from '../api/themeColors';
import { STORAGE_KEYS } from '../config/constants';
import { safeLocal } from '../utils/safeStorage';
import { getTelegramColorScheme } from './useTelegramSDK';

type Theme = 'dark' | 'light';

const THEME_KEY = STORAGE_KEYS.THEME;
const ENABLED_THEMES_KEY = STORAGE_KEYS.ENABLED_THEMES;

// Fetch enabled themes from API
async function fetchEnabledThemes(): Promise<EnabledThemes> {
  try {
    const data = await themeColorsApi.getEnabledThemes();
    // Cache for faster subsequent loads
    safeLocal.setJson(ENABLED_THEMES_KEY, data);
    return data;
  } catch {
    // Ignore errors, use cached or default
  }
  return getCachedEnabledThemes();
}

// Get cached enabled themes synchronously.
// Runs inside a useState initialiser, i.e. during render at the top of the tree:
// a bare localStorage read here white-screens the app when storage is blocked.
function getCachedEnabledThemes(): EnabledThemes {
  return safeLocal.getJson<EnabledThemes>(ENABLED_THEMES_KEY, DEFAULT_ENABLED_THEMES);
}

// Custom events for same-tab updates
const ENABLED_THEMES_CHANGED_EVENT = 'enabledThemesChanged';
const THEME_CHANGED_EVENT = 'themeChanged';

/**
 * Apply every browser-owned part of the theme in one synchronous operation.
 *
 * iOS WKWebView does not reliably repaint a background propagated from `body`
 * to the viewport canvas when only an ancestor class changes. Giving `body`
 * an explicit theme-dependent value forces that repaint and prevents the old
 * page background from remaining under freshly recoloured components.
 */
function applyThemeToDocument(theme: Theme) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
  root.style.colorScheme = theme;

  if (document.body) {
    document.body.style.backgroundColor =
      theme === 'light' ? 'var(--color-light-bg, #f7e7ce)' : 'var(--color-dark-bg, #0a0f1a)';
  }
}

// Update cache (called from admin settings)
export function updateEnabledThemesCache(themes: EnabledThemes) {
  safeLocal.setJson(ENABLED_THEMES_KEY, themes);
  // Dispatch custom event for same-tab updates
  window.dispatchEvent(new CustomEvent(ENABLED_THEMES_CHANGED_EVENT, { detail: themes }));
}

export function useTheme() {
  const [enabledThemes, setEnabledThemes] = useState<EnabledThemes>(getCachedEnabledThemes);
  const [isLoading, setIsLoading] = useState(true);

  const [theme, setThemeState] = useState<Theme>(() => {
    const enabled = getCachedEnabledThemes();

    // Check localStorage first
    if (typeof window !== 'undefined') {
      const stored = safeLocal.getItem(THEME_KEY) as Theme | null;
      if (stored === 'light' && enabled.light) {
        return 'light';
      }
      if (stored === 'dark' && enabled.dark) {
        return 'dark';
      }
      // If stored theme is disabled, use the enabled one
      if (stored && !enabled[stored]) {
        return enabled.dark ? 'dark' : 'light';
      }
      // No stored preference: follow the Telegram client's color scheme in a Mini App.
      if (!stored) {
        const tgScheme = getTelegramColorScheme();
        if (tgScheme && enabled[tgScheme]) {
          return tgScheme;
        }
      }
      // Check system preference
      if (window.matchMedia('(prefers-color-scheme: light)').matches && enabled.light) {
        return 'light';
      }
    }
    // Default to dark if enabled, otherwise light
    return enabled.dark ? 'dark' : 'light';
  });

  const themeRef = useRef(theme);
  themeRef.current = theme;

  const commitTheme = useCallback((newTheme: Theme) => {
    themeRef.current = newTheme;
    applyThemeToDocument(newTheme);
    safeLocal.setItem(THEME_KEY, newTheme);
    setThemeState(newTheme);
    window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, { detail: newTheme }));
  }, []);

  // Fetch enabled themes on mount
  useEffect(() => {
    fetchEnabledThemes().then((data) => {
      setEnabledThemes(data);
      setIsLoading(false);
      // If current theme is disabled, switch to enabled one
      if (!data[themeRef.current]) {
        const newTheme = data.dark ? 'dark' : 'light';
        commitTheme(newTheme);
      }
    });
  }, [commitTheme]);

  // Listen for localStorage changes (when admin updates enabled themes from other tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ENABLED_THEMES_KEY && e.newValue) {
        try {
          const data = JSON.parse(e.newValue) as EnabledThemes;
          setEnabledThemes(data);
          // If current theme is now disabled, switch to enabled one
          if (!data[theme]) {
            const newTheme = data.dark ? 'dark' : 'light';
            commitTheme(newTheme);
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [commitTheme, theme]);

  // Listen for same-tab enabled themes changes (from admin settings)
  useEffect(() => {
    const handleEnabledThemesChange = (e: CustomEvent<EnabledThemes>) => {
      const data = e.detail;
      setEnabledThemes(data);
      // If current theme is now disabled, switch to enabled one
      if (!data[theme]) {
        const newTheme = data.dark ? 'dark' : 'light';
        commitTheme(newTheme);
      }
    };

    window.addEventListener(
      ENABLED_THEMES_CHANGED_EVENT,
      handleEnabledThemesChange as EventListener,
    );
    return () =>
      window.removeEventListener(
        ENABLED_THEMES_CHANGED_EVENT,
        handleEnabledThemesChange as EventListener,
      );
  }, [commitTheme, theme]);

  // Apply theme to document - also check if theme is disabled and switch
  useEffect(() => {
    // If current theme is disabled, switch to the enabled one
    if (!enabledThemes[theme]) {
      const newTheme = enabledThemes.dark ? 'dark' : 'light';
      if (newTheme !== theme) {
        commitTheme(newTheme);
        return; // Will re-run with correct theme
      }
    }

    applyThemeToDocument(theme);
    safeLocal.setItem(THEME_KEY, theme);
  }, [commitTheme, theme, enabledThemes]);

  // Listen for same-tab theme changes (from other useTheme() instances)
  useEffect(() => {
    const handleThemeChange = (e: CustomEvent<Theme>) => {
      if (e.detail === themeRef.current) return;
      themeRef.current = e.detail;
      applyThemeToDocument(e.detail);
      setThemeState(e.detail);
    };

    window.addEventListener(THEME_CHANGED_EVENT, handleThemeChange as EventListener);
    return () =>
      window.removeEventListener(THEME_CHANGED_EVENT, handleThemeChange as EventListener);
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');

    const handleChange = (e: MediaQueryListEvent) => {
      const stored = safeLocal.getItem(THEME_KEY);
      // Only auto-switch if user hasn't set a preference and theme is enabled
      if (!stored) {
        const newTheme = e.matches ? 'light' : 'dark';
        if (enabledThemes[newTheme]) {
          commitTheme(newTheme);
        }
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [commitTheme, enabledThemes]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      // Only allow setting if theme is enabled
      if (enabledThemes[newTheme]) {
        commitTheme(newTheme);
      }
    },
    [commitTheme, enabledThemes],
  );

  const toggleTheme = useCallback(() => {
    const newTheme = themeRef.current === 'dark' ? 'light' : 'dark';
    if (enabledThemes[newTheme]) {
      commitTheme(newTheme);
    }
  }, [commitTheme, enabledThemes]);

  const isDark = theme === 'dark';
  const isLight = theme === 'light';

  // Check if theme switching is available (both themes enabled and loaded)
  const canToggle = !isLoading && enabledThemes.dark && enabledThemes.light;

  // Refresh enabled themes from API
  const refreshEnabledThemes = useCallback(() => {
    fetchEnabledThemes().then((data) => {
      setEnabledThemes(data);
      if (!data[theme]) {
        const newTheme = data.dark ? 'dark' : 'light';
        commitTheme(newTheme);
      }
    });
  }, [commitTheme, theme]);

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark,
    isLight,
    enabledThemes,
    canToggle,
    isLoading,
    refreshEnabledThemes,
  };
}
