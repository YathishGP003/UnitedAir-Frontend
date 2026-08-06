import { useEffect } from "react";

export type Theme = "light";
const STORAGE_KEY = "unitedair.theme";

export function initialTheme(): Theme {
  return "light";
}

export function useTheme() {
  const theme = initialTheme();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.removeItem(STORAGE_KEY);
  }, [theme]);

  return { theme };
}
