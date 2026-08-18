import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { dark, light, type Palette } from './tokens'

export * from './tokens'

const ThemeContext = createContext<Palette>(light)

/** Default to system. Both themes ship (§12.2). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme()
  const palette = useMemo(() => (scheme === 'dark' ? dark : light), [scheme])
  return <ThemeContext.Provider value={palette}>{children}</ThemeContext.Provider>
}

export function useTheme(): Palette {
  return useContext(ThemeContext)
}
