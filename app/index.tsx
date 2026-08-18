import { Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { Card, PrimaryButton, Screen } from '@/components/Screen'
import { LegalFooter } from '@/components/LegalFooter'
import { space, type as typeTokens, useTheme } from '@/theme'
import { t } from '@/lib/i18n'

const CITY = process.env.EXPO_PUBLIC_DEFAULT_CITY ?? 'bengaluru'

export default function Home() {
  const c = useTheme()
  const router = useRouter()

  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <Text style={{ ...typeTokens.title, color: c.text }}>{t('app.name')}</Text>
        <Text style={{ ...typeTokens.body, color: c.textMuted }}>{t('app.tagline')}</Text>
      </View>

      <Card>
        <Text style={{ ...typeTokens.body, color: c.text }}>
          Hiring a tradesperson is a negotiation where only one side knows the price. This is
          the other side of it: what people in your area reported paying, for the exact job.
        </Text>
        <Text style={{ ...typeTokens.small, color: c.textMuted }}>
          {t('auth.no_account_needed')}
        </Text>
      </Card>

      <Link href={`/prices/${CITY}`} asChild>
        <PrimaryButton label="See plumbing prices" onPress={() => router.push(`/prices/${CITY}`)} />
      </Link>

      <Card>
        <Text style={{ ...typeTokens.body, fontWeight: '600', color: c.text }}>
          Paid for a job recently?
        </Text>
        <Text style={{ ...typeTokens.small, color: c.textMuted }}>
          Two minutes, and you find out immediately how it compared.
        </Text>
        <PrimaryButton label={t('benchmark.empty.cta')} onPress={() => router.push('/report')} />
      </Card>

      <LegalFooter />
    </Screen>
  )
}
