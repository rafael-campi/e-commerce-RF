import { useEffect, useState } from 'react';

// "system" segue o sistema operacional; os outros fixam o tema em <html data-theme>.
export type Theme = 'system' | 'light' | 'dark';
const KEY = 'prateleira.theme';
const ORDER: Theme[] = ['system', 'light', 'dark'];

function read(): Theme {
  try {
    const saved = localStorage.getItem(KEY) as Theme | null;
    return saved && ORDER.includes(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // preferência só nesta visita
    }
  }, [theme]);

  const next = () =>
    setTheme((t) => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length]);
  return { theme, next };
}

// aplica antes do primeiro render, para não piscar o tema errado
applyTheme(read());
