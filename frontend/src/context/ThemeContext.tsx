import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

export interface ChartTheme {
  grid: string;
  tick: string;
  tooltip: {
    contentStyle: { fontSize: number; borderRadius: number; borderColor: string; backgroundColor: string; color: string };
    labelStyle: { color: string };
  };
  rain: string;
  tempMax: string;
  tempMean: string;
  tempMin: string;
  et0: string;
  humidity: string;
  solar: string;
  wind: string;
  soil: string;
  taw: string;
  raw: string;
  depletion: string;
  ndvi: string;
}

interface ThemeValue {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  chart: ChartTheme;
}

const STORAGE_KEY = "agrinasa:theme";
const ThemeContext = createContext<ThemeValue | null>(null);

const CHARTS: Record<Theme, ChartTheme> = {
  light: {
    grid: "#e0e6db",
    tick: "#5b6b60",
    tooltip: {
      contentStyle: {
        fontSize: 12,
        borderRadius: 6,
        borderColor: "#e0e6db",
        backgroundColor: "#ffffff",
        color: "#14231b",
      },
      labelStyle: { color: "#5b6b60" },
    },
    rain: "#9fc6d6",
    tempMax: "#c25d3f",
    tempMean: "#b4693a",
    tempMin: "#d09a7a",
    et0: "#8a4b32",
    humidity: "#3c7a63",
    solar: "#b58a2f",
    wind: "#6b7f76",
    soil: "#6d5a43",
    taw: "#b8d6e1",
    raw: "#a97c4b",
    depletion: "#8a4b32",
    ndvi: "#246248",
  },
  dark: {
    grid: "#28372f",
    tick: "#96a89e",
    tooltip: {
      contentStyle: {
        fontSize: 12,
        borderRadius: 6,
        borderColor: "#38473f",
        backgroundColor: "#121b17",
        color: "#e2ede7",
      },
      labelStyle: { color: "#96a89e" },
    },
    rain: "#4f8fa8",
    tempMax: "#e59a78",
    tempMean: "#e0a384",
    tempMin: "#c98d74",
    et0: "#e08e6f",
    humidity: "#7fd3a9",
    solar: "#e0c070",
    wind: "#9fb3a8",
    soil: "#c9b394",
    taw: "#6fa9bf",
    raw: "#d9b184",
    depletion: "#e08e6f",
    ndvi: "#6fcf9f",
  },
};

function initialTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Light/dark theme, persisted locally. The `.dark` class flips the CSS variable
 * palette in index.css; chart colours are exposed here because Recharts needs
 * concrete values rather than CSS classes.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((current) => (current === "dark" ? "light" : "dark")),
    [],
  );

  const value = useMemo(
    () => ({ theme, isDark: theme === "dark", setTheme, toggleTheme, chart: CHARTS[theme] }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
