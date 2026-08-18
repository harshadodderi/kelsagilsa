import { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Head from 'expo-router/head'
import { Card, PrimaryButton, Screen } from '@/components/Screen'
import { LegalFooter } from '@/components/LegalFooter'
import { PriceFigure } from '@/components/PriceFigure'
import { space, type as typeTokens, useTheme } from '@/theme'
import { getAreaBenchmark, type Benchmark } from '@/lib/api'
import { encodeGeohash } from '@/lib/geohash'
import { rupees } from '@/lib/money'
import { t } from '@/lib/i18n'
import { CITIES, JOB_TYPE_SLUGS, jobTypeName } from '@/data/launch-set'
import { bakedBenchmark } from '@/data/benchmarks.generated'

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

  /*
   * The city figure is baked in at build time, so this page renders its
   * numbers in the static HTML with no round trip and no JavaScript. That is
   * the whole point of pre-rendering it: a client-rendered price page is
   * invisible to a search engine, and slow on the connection this is built for.
   *
   * There is deliberately no loading state on first paint. The page starts
   * complete and honest at the city level, then narrows.
   */
  const baked = bakedBenchmark(city, job)

  const [benchmark, setBenchmark] = useState<Benchmark | null>(
    baked
      ? {
          job_type_slug: job,
          job_type_name: baked.jobTypeName,
          area_name: baked.areaName,
          area_level: 'city',
          n: baked.n,
          tier: baked.tier,
          low: baked.low,
          high: baked.high,
          mid: baked.mid,
          updated_at: '',
        }
      : null,
  )

  const refine = useCallback(async () => {
    try {
      // Narrow to the reader's locality if the browser will say where it is.
      // A refusal is a normal outcome, not an error: the city figure stands.
      const geohash = await currentGeohash()
      if (!geohash) return
      const local = await getAreaBenchmark(geohash, job)
      if (local) setBenchmark(local)
    } catch {
      // The baked figure is already on screen. A failed refinement is not
      // worth an error state.
    }
  }, [job])

  useEffect(() => {
    void refine()
  }, [refine])

  const jobLabel = benchmark?.job_type_name ?? jobTypeName(job)
  const areaLabel = benchmark?.area_name ?? city
  const addReport = () => router.push({ pathname: '/report', params: { job, city } })

  return (
    <Screen>
      {/*
        The title is the search result. It carries the job and the place,
        because that is what someone types, and it says "price" rather than
        "benchmark" — nobody searches for a benchmark.
      */}
      <Head>
        <title>{`${jobLabel} price in ${areaLabel} — Kelsagilsa`}</title>
        <meta name="description" content={description(jobLabel, areaLabel, benchmark)} />
      </Head>

      <Card>
        <Text accessibilityRole="header" style={{ ...typeTokens.title, color: c.text }}>
          {t('benchmark.title', { jobType: jobLabel, area: areaLabel })}
        </Text>

        {benchmark && benchmark.tier !== 'none' && (
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
 * The snippet a search engine shows. It carries the range and the sample size
 * for the same reason the page does: a number without its n is a claim.
 */
function description(jobLabel: string, areaLabel: string, benchmark: Benchmark | null): string {
  if (!benchmark || benchmark.low === null || benchmark.high === null) {
    return `What people report paying for ${jobLabel.toLowerCase()} in ${areaLabel}. Reported prices, not quotes.`
  }
  return (
    `What people reported paying for ${jobLabel.toLowerCase()} in ${areaLabel}: ` +
    `usually ${rupees(benchmark.low)}–${rupees(benchmark.high)}, from ${benchmark.n} reports ` +
    `in the last 12 months. Not a quote.`
  )
}

/**
 * Current location only, never stored (§10.4). Denied permission is a normal
 * outcome — the city figure is a fine answer.
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
