import { useCallback, useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Card, ErrorState, Loading, Screen } from '@/components/Screen'
import { LegalFooter } from '@/components/LegalFooter'
import { layout, radius, space, type as typeTokens, useTheme } from '@/theme'
import {
  getCoverage,
  getMondayReview,
  getOrganicShare,
  moderateReport,
  type Coverage,
  type OrganicShare,
  getMyProfile,
  type ReviewItem,
} from '@/lib/api'

const BUCKET_LABELS: Record<ReviewItem['bucket'], string> = {
  low_weight: 'Weighted down this week',
  flagged_outlier: 'Flagged outliers awaiting review',
  single_booking_new_account: 'New account, one booking, one provider',
}

const BUCKET_NOTES: Record<ReviewItem['bucket'], string> = {
  low_weight:
    'These still count, at less. Look for a pattern, not for individual rows to punish.',
  flagged_outlier:
    'Excluded from every figure until reviewed. Reinstating restores full weight; hiding keeps the row and logs the action. Neither deletes anything.',
  single_booking_new_account:
    'This query catches the self-review loop better than any heuristic you will write.',
}

/**
 * The Monday review (§9.4). Ten minutes, one page, once a week.
 *
 * Deliberately not linked from anywhere: it is a route you type. Everything on
 * it is gated on `role = 'admin'` inside the database, so a curious signed-in
 * user gets nothing but a permission error.
 */
export default function AdminReview() {
  const c = useTheme()
  const [items, setItems] = useState<ReviewItem[] | null>(null)
  const [share, setShare] = useState<OrganicShare | null>(null)
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const profile = await getMyProfile()
      if (profile?.role !== 'admin') {
        setError('This page is for the review administrator.')
        return
      }
      const [review, organic, cover] = await Promise.all([
        getMondayReview(),
        getOrganicShare(7),
        getCoverage(),
      ])
      setItems(review)
      setShare(organic)
      setCoverage(cover)
    } catch {
      setError('Could not load the review.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={() => void load()} />
        <LegalFooter />
      </Screen>
    )
  }
  if (!items) return <Screen><Loading /><LegalFooter /></Screen>

  const buckets = Object.keys(BUCKET_LABELS) as ReviewItem['bucket'][]

  return (
    <Screen>
      <Text accessibilityRole="header" style={{ ...typeTokens.title, color: c.text }}>
        Monday review
      </Text>

      {/*
        Metric zero first, every week, before anything else on the page. A
        coverage number can look healthy while the product acquires nothing on
        its own; this one cannot (§13.1).
      */}
      <Card>
        <Text style={{ ...typeTokens.small, color: c.textMuted }}>
          Organic report share, last 7 days
        </Text>
        <Text style={{ ...typeTokens.price, ...typeTokens.mono, color: c.text }}>
          {share?.organic_share === null || share === null
            ? '—'
            : `${Math.round(share.organic_share * 100)}%`}
        </Text>
        <Text style={{ ...typeTokens.small, color: c.textMuted }}>
          {share ? `${share.organic} organic of ${share.total} reports` : ''}
        </Text>
        {share && share.organic < 20 && (
          <Text style={{ ...typeTokens.small, color: c.warn }}>
            Under 20 organic reports this week. Four weeks of this, with share under 15%, is
            the Phase 2 kill criterion.
          </Text>
        )}
      </Card>

      <Card>
        <Text style={{ ...typeTokens.small, color: c.textMuted }}>
          Benchmark coverage — locality and job-type pairs
        </Text>
        <Text style={{ ...typeTokens.priceSmall, ...typeTokens.mono, color: c.text }}>
          {coverage ? `${coverage.pairs_n10} at n≥10 · ${coverage.pairs_n20} at n≥20` : '—'}
        </Text>
        <Text style={{ ...typeTokens.small, color: c.textMuted }}>
          n≥20 is the number that makes a page worth linking.
        </Text>
      </Card>

      {buckets.map((bucket) => {
        const rows = items.filter((item) => item.bucket === bucket)
        return (
          <View key={bucket} style={{ gap: space.sm }}>
            <Text style={{ ...typeTokens.body, fontWeight: '600', color: c.text }}>
              {BUCKET_LABELS[bucket]} ({rows.length})
            </Text>
            <Text style={{ ...typeTokens.small, color: c.textMuted }}>
              {BUCKET_NOTES[bucket]}
            </Text>

            {rows.length === 0 ? (
              <Text style={{ ...typeTokens.small, color: c.textMuted }}>Nothing this week.</Text>
            ) : (
              rows.map((item) => (
                <Card key={`${bucket}-${item.subject_id}`}>
                  <Text style={{ ...typeTokens.body, color: c.text }}>{item.detail}</Text>
                  <Text style={{ ...typeTokens.small, ...typeTokens.mono, color: c.textMuted }}>
                    {new Date(item.at).toLocaleDateString('en-IN')} · {item.subject_id.slice(0, 8)}
                  </Text>

                  {bucket === 'flagged_outlier' && (
                    <View style={{ flexDirection: 'row', gap: space.sm }}>
                      <Action
                        label="Reinstate"
                        onPress={async () => {
                          await moderateReport(item.subject_id, 'reinstate', 'Monday review')
                          await load()
                        }}
                      />
                      <Action
                        label="Hide"
                        onPress={async () => {
                          await moderateReport(item.subject_id, 'hide', 'Monday review')
                          await load()
                        }}
                      />
                    </View>
                  )}
                </Card>
              ))
            )}
          </View>
        )
      })}

      <LegalFooter />
    </Screen>
  )
}

function Action({ label, onPress }: { label: string; onPress: () => Promise<void> }) {
  const c = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void onPress()}
      style={{
        minHeight: layout.minTapTarget,
        justifyContent: 'center',
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <Text style={{ ...typeTokens.body, color: c.text }}>{label}</Text>
    </Pressable>
  )
}
