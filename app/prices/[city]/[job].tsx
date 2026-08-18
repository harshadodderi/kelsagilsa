import { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Card, ErrorState, Loading, PrimaryButton, Screen } from '@/components/Screen'
import { LegalFooter } from '@/components/LegalFooter'
import { PriceFigure } from '@/components/PriceFigure'
import { space, type as typeTokens, useTheme } from '@/theme'
import { getAreaBenchmark, getCityBenchmarks, type Benchmark } from '@/lib/api'
import { encodeGeohash } from '@/lib/geohash'
import { t } from '@/lib/i18n'
import { CITIES, JOB_TYPE_SLUGS } from '@/data/launch-set'

/**
 * The acquisition channel. Pre-rendered as real HTML (§12.5), readable with no
 * account (§5.2) — a signup wall here destroys the exact thing Phase 2
 * measures.
 */
export async function generateStaticParams() {
  return CITIES.flatMap((city) => JOB_TYPE_SLUGS.map((job) => ({ city, job })))
}

export default function JobBenchmark() {
  const { city, job } = useLocalSearchParams<{ city: string; job: string }>()
  const router = useRouter()
  const c = useTheme()

  const [benchmark, setBenchmark] = useState<Benchmark | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setBenchmark(undefined)
    try {
      // Ask the browser where it is, and fall back to the city figure. The
      // fallback is never silent: the level shown is named below.
      const geohash = await currentGeohash()
      if (geohash) {
        const local = await getAreaBenchmark(geohash, job)
        if (local) {
          setBenchmark(local)
          return
        }
      }

      const cityRows = await getCityBenchmarks(city)
      const row = cityRows.find((r) => r.job_type_slug === job)
      setBenchmark(
        row
          ? {
              job_type_slug: row.job_type_slug,
              job_type_name: row.job_type_name,
              area_name: city,
              area_level: 'city',
              n: row.n,
              tier: row.tier,
              low: row.low,
              high: row.high,
              mid: row.mid,
              updated_at: '',
            }
          : null,
      )
    } catch {
      setError(t('error.generic'))
    }
  }, [city, job])

  useEffect(() => {
    void load()
  }, [load])

  if (error) return <Screen><ErrorState message={error} onRetry={() => void load()} /></Screen>
  if (benchmark === undefined) return <Screen><Loading /></Screen>

  const addReport = () =>
    router.push({ pathname: '/report', params: { job, city } })

  return (
    <Screen>
      <Card>
        <Text style={{ ...typeTokens.title, color: c.text }}>
          {benchmark
            ? t('benchmark.title', { jobType: benchmark.job_type_name, area: benchmark.area_name })
            : job}
        </Text>

        {benchmark && (
          <Text style={{ ...typeTokens.small, color: c.textMuted }}>
            {t(`benchmark.level.${benchmark.area_level}` as Parameters<typeof t>[0], {
              area: benchmark.area_name,
            })}
          </Text>
        )}

        <View style={{ paddingTop: space.sm }}>
          <PriceFigure
            n={benchmark?.n ?? 0}
            tier={benchmark?.tier ?? 'none'}
            low={benchmark?.low ?? null}
            high={benchmark?.high ?? null}
            mid={benchmark?.mid ?? null}
            emptyAction={<PrimaryButton label={t('benchmark.empty.cta')} onPress={addReport} />}
          />
        </View>
      </Card>

      {/* §11.5: what is included and excluded, the window, the sample size,
          the area level — all on the page, not in a tooltip. */}
      <Card>
        <Text style={{ ...typeTokens.small, color: c.textMuted }}>{t('legal.window')}</Text>
        <Text style={{ ...typeTokens.small, color: c.textMuted }}>{t('legal.excluded')}</Text>
      </Card>

      {benchmark && benchmark.tier !== 'none' && (
        <PrimaryButton label={t('benchmark.empty.cta')} onPress={addReport} />
      )}

      <LegalFooter />
    </Screen>
  )
}

/**
 * Current location only, never stored (§10.4). Denied permission is a normal
 * outcome, not an error state — the city figure is a fine answer.
 */
async function currentGeohash(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(encodeGeohash(pos.coords.latitude, pos.coords.longitude, 6)),
      () => resolve(null),
      { timeout: 4000, maximumAge: 300_000 },
    )
  })
}
