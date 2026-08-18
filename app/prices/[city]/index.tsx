import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { Link, useLocalSearchParams } from 'expo-router'
import { Card, ErrorState, Loading, Screen } from '@/components/Screen'
import { LegalFooter } from '@/components/LegalFooter'
import { space, type as typeTokens, useTheme } from '@/theme'
import { getCityBenchmarks, type CityBenchmarkRow } from '@/lib/api'
import { rupeeRange } from '@/lib/money'
import { t } from '@/lib/i18n'
import { CITIES } from '@/data/launch-set'

/** Pre-rendered at build time (§12.5). */
export async function generateStaticParams() {
  return CITIES.map((city) => ({ city }))
}

export default function CityPrices() {
  const { city } = useLocalSearchParams<{ city: string }>()
  const c = useTheme()
  const [rows, setRows] = useState<CityBenchmarkRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    getCityBenchmarks(city)
      .then((data) => !cancelled && setRows(data))
      .catch(() => !cancelled && setError(t('error.generic')))
    return () => {
      cancelled = true
    }
  }, [city])

  if (error) return <Screen><ErrorState message={error} /></Screen>
  if (!rows) return <Screen><Loading /></Screen>

  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <Text style={{ ...typeTokens.title, color: c.text }}>Plumbing prices</Text>
        <Text style={{ ...typeTokens.small, color: c.textMuted }}>{t('legal.window')}</Text>
      </View>

      {rows.map((row) => {
        const range = rupeeRange(row.low, row.high)
        return (
          <Link key={row.job_type_slug} href={`/prices/${city}/${row.job_type_slug}`} asChild>
            <Card>
              <Text style={{ ...typeTokens.body, fontWeight: '600', color: c.text }}>
                {row.job_type_name}
                {row.size_qualifier ? ` — ${row.size_qualifier}` : ''}
              </Text>

              {range ? (
                <>
                  <Text style={{ ...typeTokens.priceSmall, ...typeTokens.mono, color: c.text }}>
                    {range}
                  </Text>
                  <Text style={{ ...typeTokens.small, color: c.textMuted }}>
                    {t('benchmark.tier.plain', { n: row.n })}
                  </Text>
                </>
              ) : (
                <Text style={{ ...typeTokens.small, color: c.textMuted }}>
                  {row.typical_hint ?? t('benchmark.tier.none')}
                </Text>
              )}
            </Card>
          </Link>
        )
      })}

      <LegalFooter />
    </Screen>
  )
}
