import { Text, View } from 'react-native'
import { space, type as typeTokens, useTheme } from '@/theme'

export function H1({ children }: { children: string }) {
  const c = useTheme()
  return <Text accessibilityRole="header" style={{ ...typeTokens.title, color: c.text }}>{children}</Text>
}

export function H2({ children }: { children: string }) {
  const c = useTheme()
  return (
    <Text accessibilityRole="header" style={{ ...typeTokens.body, fontWeight: '700', color: c.text, paddingTop: space.md }}>
      {children}
    </Text>
  )
}

export function P({ children }: { children: React.ReactNode }) {
  const c = useTheme()
  return <Text style={{ ...typeTokens.body, color: c.text, lineHeight: 26 }}>{children}</Text>
}

export function Section({ children }: { children: React.ReactNode }) {
  return <View style={{ gap: space.sm }}>{children}</View>
}
