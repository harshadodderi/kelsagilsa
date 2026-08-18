import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { Link, useLocalSearchParams } from 'expo-router'
import Head from 'expo-router/head'
import { Card, Screen } from '@/components/Screen'
import { LegalFooter } from '@/components/LegalFooter'
import { space, type as typeTokens, useTheme } from '@/theme'
import { getCityBenchmarks, type CityBenchmarkRow } from '@/lib/api'
import { rupeeRange } from '@/lib/money'
import { t } from '@/lib/i18n'
import { CITIES, JOB_TYPES } from '@/data/launch-set'
import { BAKED_BENCHMARKS } from '@/data/benchmarks.generated'

/** Pre-rendered at build time (§12.5). */
export async function generateStaticParams() {
  return CITIES.map((city) => ({ city }))
}

/**
 * The index of a city's price pages, rendered from the figures baked in at
 * build time so the static HTML carries real numbers rather than a spinner.
 * It refreshes from the database on mount, which matters between nightly
 * rebuilds.
 */
export default function CityPrices() {
  const { city } = useLocalSearchParams<{ city: string }>()
  const c = useTheme()
  const [rows, setRows] = useState<CityBenchmarkRow[]>(() => bakedRows(city))
  const [stale, setStale] = useState(false)

  useEffect(() => {
    let cancelled = false
    getCityBenchmarks(city)
      .then((data) => !cancelled && data.length > 0 && setRows(data))
      .catch(() => !cancelled && setStale(true))
    return () => {
      cancelled = true
    }
  }, [city])

  const cityName = cityLabel(city)

  return (
    <Screen>
      <Head>
        <title>{`Plumbing prices in ${cityName} — Kelsagilsa`}</title>
        <meta
          name="description"
          content={`What people in ${cityName} report paying for plumbing work, by job. Reported prices from the last 12 months, with the number of reports behind each one. Not quotes.`}
        />
      </Head>

      <View style={{ gap: space.xs }}>
        <Text accessibilityRole="header" style={{ ...typeTokens.title, color: c.text }}>
          Plumbing prices in {cityName}
        </Text>
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
                // No number yet is not an error. It is an invitation.
                <Text style={{ ...typeTokens.small, color: c.textMuted }}>
                  {row.typical_hint ?? t('benchmark.tier.none')}
                </Text>
              )}
            </Card>
          </Link>
        )
      })}

      {stale && (
        <Text style={{ ...typeTokens.small, color: c.textMuted }}>
          Showing the most recent figures we have. {t('error.offline')}
        </Text>
      )}

      <LegalFooter />
    </Screen>
  )
}

/**
 * The baked figures, in the launch set's order. Job types with no baked entry
 * still appear — a page with no reports yet is the report form, and it is the
 * page that fills itself.
 */
function bakedRows(city: string): CityBenchmarkRow[] {
  const baked = BAKED_BENCHMARKS[city] ?? {}
  return JOB_TYPES.map(({ slug, name, sizeQualifier, typicalHint }) => {
    const figure = baked[slug]
    return {
      job_type_slug: slug,
      job_type_name: name,
      size_qualifier: sizeQualifier,
      typical_hint: typicalHint,
      n: figure?.n ?? 0,
      tier: figure?.tier ?? 'none',
      low: figure?.low ?? null,
      high: figure?.high ?? null,
      mid: figure?.mid ?? null,
    }
  })
}

function cityLabel(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}
