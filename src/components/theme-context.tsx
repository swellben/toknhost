"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type ThemeByMode = Record<string, { variables: Record<string, string> }>;

interface ThemeContextValue {
  byMode: ThemeByMode | null;
  applyOptimistic: (modeName: string, cssVar: string, cssValue: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  byMode: null,
  applyOptimistic: () => {},
});

export function ThemeProvider({
  children,
  initialByMode,
}: {
  children: React.ReactNode;
  initialByMode: ThemeByMode | null;
}) {
  const [byMode, setByMode] = useState<ThemeByMode | null>(initialByMode);

  // When router.refresh() delivers fresh server data, replace our local state
  // so saved values always win over stale optimistic patches.
  useEffect(() => {
    setByMode(initialByMode);
  }, [initialByMode]);

  const applyOptimistic = useCallback(
    (modeName: string, cssVar: string, cssValue: string) => {
      setByMode((prev) => {
        if (!prev?.[modeName]) return prev;
        return {
          ...prev,
          [modeName]: {
            ...prev[modeName],
            variables: { ...prev[modeName].variables, [cssVar]: cssValue },
          },
        };
      });
    },
    []
  );

  return (
    <ThemeContext.Provider value={{ byMode, applyOptimistic }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
