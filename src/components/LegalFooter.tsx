import { Text, View } from 'react-native'
import { Link } from 'expo-router'
import { space, type as typeTokens, useTheme } from '@/theme'

/**
 * Terms and privacy notice, linked from every footer, plus the named grievance
 * officer (§11.1). This is what stands between you and personal liability for
 * a defamatory report about a named tradesperson — it is a gate, not a
 * footer detail, which is why it is a component that every screen mounts
 * rather than a page someone remembers to link.
 */
export function LegalFooter() {
  const c = useTheme()
  const linkStyle = { ...typeTokens.small, color: c.textMuted, textDecorationLine: 'underline' as const }

  return (
    <View style={{ gap: space.xs, paddingTop: space.lg }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        <Link href="/legal/terms" style={linkStyle}>Terms</Link>
        <Link href="/legal/privacy" style={linkStyle}>Privacy</Link>
        <Link href="/legal/grievance" style={linkStyle}>Grievance officer</Link>
      </View>
      <Text style={{ ...typeTokens.small, color: c.textMuted }}>
        Kelsagilsa publishes what people report paying. It is not a quote, and it does not
        employ or vouch for anyone.
      </Text>
    </View>
  )
}
