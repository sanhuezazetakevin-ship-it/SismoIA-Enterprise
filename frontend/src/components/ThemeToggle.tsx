import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../app/theme';
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === 'light' ? 'oscuro' : 'claro';
  return <button type="button" className="icon-button theme-button" onClick={toggleTheme} aria-label={`Cambiar a modo ${next}`} title={`Cambiar a modo ${next}`}>
    {theme === 'light' ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
    <span className="theme-label">{theme === 'light' ? 'Oscuro' : 'Claro'}</span>
  </button>;
}
