import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
type Theme = 'light' | 'dark';
type ContextValue = { theme: Theme; toggleTheme: () => void };
const ThemeContext = createContext<ContextValue | null>(null);
function getInitialTheme(): Theme {
  try { const stored = window.localStorage.getItem('sismoia-theme'); if (stored === 'dark' || stored === 'light') return stored; } catch { /* private browsing */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { window.localStorage.setItem('sismoia-theme', theme); } catch { /* storage optional */ }
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme(value => value === 'light' ? 'dark' : 'light'), []);
  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme() { const context = useContext(ThemeContext); if (!context) throw new Error('ThemeProvider missing'); return context; }
