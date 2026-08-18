import { useEffect, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Card, PrimaryButton, Screen } from '@/components/Screen'
import { LegalFooter } from '@/components/LegalFooter'
import { PriceFigure } from '@/components/PriceFigure'
import { layout, radius, space, type as typeTokens, useTheme } from '@/theme'
import { compareToBenchmark, submitBookingLessReport, type Comparison } from '@/lib/api'
import { supabase, sendOtp, verifyOtp } from '@/lib/supabase'
import { encodeGeohash } from '@/lib/geohash'
import { userFacingMessage } from '@/lib/errors'
import { rupees } from '@/lib/money'
import { t } from '@/lib/i18n'
import { JOB_TYPE_SLUGS } from '@/data/launch-set'

type PartsAnswer = 'yes' | 'no' | 'unsure'

interface Draft {
  jobSlug: string
  amountPaid: string
  partsAnswer: PartsAnswer
  partsAmount: string
  occurredOn: string
  areaGeohash: string | null
  nameInPublicFeed: boolean
}

type Stage = 'form' | 'auth' | 'payback'

/**
 * The booking-less report (§7.6) and the instant payback (§7.4).
 *
 * Two rules shape this screen and neither is negotiable:
 *
 *  1. Sign-in happens AFTER the numbers are entered, never before (§5.2). The
 *     draft is held in local state, the person is signed in, and only then is
 *     it written. Someone who abandons at the OTP screen has still told you
 *     what they paid — that abandonment is metric #4 (§13.2).
 *
 *  2. "Not sure" about parts stays selectable forever (§3.3). A cornered
 *     customer invents a number, and an invented split is indistinguishable
 *     from a real one once it is in the aggregate.
 *
 * Note what this form does NOT ask: who did the work. A booking-less report
 * cannot feed provider stats (§6.1), and asking implies otherwise.
 */
export default function ReportScreen() {
  const { job } = useLocalSearchParams<{ job?: string }>()
  const c = useTheme()

  const [draft, setDraft] = useState<Draft>({
    jobSlug: job && (JOB_TYPE_SLUGS as readonly string[]).includes(job) ? job : JOB_TYPE_SLUGS[0],
    amountPaid: '',
    partsAnswer: 'unsure',
    partsAmount: '',
    occurredOn: thisMonth(),
    areaGeohash: null,
    nameInPublicFeed: false,
  })

  const [stage, setStage] = useState<Stage>('form')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comparison, setComparison] = useState<Comparison | null>(null)

  useEffect(() => {
    void locate().then((g) => g && setDraft((d) => ({ ...d, areaGeohash: g })))
  }, [])

  const amount = Number(draft.amountPaid)
  const parts = draft.partsAnswer === 'yes' ? Number(draft.partsAmount) : draft.partsAnswer === 'no' ? 0 : null
  const serviceAmount = amount - (parts ?? 0)
  const complete = Number.isFinite(amount) && amount > 0 && (parts === null || parts < amount)

  async function persist() {
    setBusy(true)
    setError(null)
    try {
      await submitBookingLessReport({
        jobSlug: draft.jobSlug,
        amountPaid: amount,
        partsAmount: parts,
        occurredOn: `${draft.occurredOn}-15`, // month precision, mid-month
        areaGeohash: draft.areaGeohash ?? '',
        nameInPublicFeed: draft.nameInPublicFeed,
      })

      // Payback first, before anything else. This screen is the entire
      // incentive design (§7.4).
      setComparison(
        await compareToBenchmark(draft.areaGeohash ?? '', draft.jobSlug, serviceAmount),
      )
      setStage('payback')
    } catch (e) {
      setError(userFacingMessage(e as { code?: string; message?: string }, t('error.generic')))
    } finally {
      setBusy(false)
    }
  }

  async function continueFromForm() {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      await persist()
    } else {
      setStage('auth')
    }
  }

  if (stage === 'payback') {
    return (
      <Screen>
        <Card>
          <Text style={{ ...typeTokens.body, color: c.text }}>
            {t('payback.you_paid', { amount: rupees(amount), jobType: draft.jobSlug })}
          </Text>

          {comparison && comparison.tier !== 'none' ? (
            <>
              <PriceFigure
                n={comparison.n}
                tier={comparison.tier}
                low={comparison.low}
                high={comparison.high}
                mid={comparison.mid}
              />
              <Text style={{ ...typeTokens.body, color: c.text }}>
                {t(`payback.${comparison.verdict === 'unknown' ? 'within' : comparison.verdict}`)}
              </Text>
            </>
          ) : (
            // Below n=5, say so honestly rather than showing a number nobody
            // has earned (§7.4).
            <Text style={{ ...typeTokens.body, color: c.textMuted }}>{t('payback.no_data')}</Text>
          )}

          <Text style={{ ...typeTokens.small, color: c.textMuted }}>{t('payback.thanks')}</Text>
        </Card>
        <LegalFooter />
      </Screen>
    )
  }

  if (stage === 'auth') {
    return (
      <SignIn
        onSignedIn={persist}
        onBack={() => setStage('form')}
        busy={busy}
        error={error}
      />
    )
  }

  return (
    <Screen>
      <Card>
        <Label>{t('report.job_type')}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {JOB_TYPE_SLUGS.map((slug) => (
            <Chip
              key={slug}
              label={slug.replace(/-/g, ' ')}
              selected={draft.jobSlug === slug}
              onPress={() => setDraft({ ...draft, jobSlug: slug })}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Label>{t('report.amount')}</Label>
        <Input
          value={draft.amountPaid}
          onChangeText={(v) => setDraft({ ...draft, amountPaid: v.replace(/[^0-9]/g, '') })}
          keyboardType="number-pad"
          placeholder="₹"
        />
      </Card>

      <Card>
        <Label>{t('report.parts.question')}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Chip
            label={t('report.parts.yes')}
            selected={draft.partsAnswer === 'yes'}
            onPress={() => setDraft({ ...draft, partsAnswer: 'yes' })}
          />
          <Chip
            label={t('report.parts.no')}
            selected={draft.partsAnswer === 'no'}
            onPress={() => setDraft({ ...draft, partsAnswer: 'no', partsAmount: '' })}
          />
          {/* Never removed, never de-emphasised, never nagged about. */}
          <Chip
            label={t('report.parts.unsure')}
            selected={draft.partsAnswer === 'unsure'}
            onPress={() => setDraft({ ...draft, partsAnswer: 'unsure', partsAmount: '' })}
          />
        </View>

        {draft.partsAnswer === 'yes' && (
          <>
            <Label>{t('report.parts.amount')}</Label>
            <Input
              value={draft.partsAmount}
              onChangeText={(v) => setDraft({ ...draft, partsAmount: v.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
              placeholder="₹"
            />
          </>
        )}
      </Card>

      <Card>
        <Label>{t('report.when')}</Label>
        <Input
          value={draft.occurredOn}
          onChangeText={(v) => setDraft({ ...draft, occurredOn: v })}
          placeholder="YYYY-MM"
        />
      </Card>

      <Pressable
        onPress={() => setDraft({ ...draft, nameInPublicFeed: !draft.nameInPublicFeed })}
        style={{ minHeight: layout.minTapTarget, justifyContent: 'center' }}
      >
        <Text style={{ ...typeTokens.body, color: c.text }}>
          {draft.nameInPublicFeed ? '☑' : '☐'} {t('report.name_in_feed')}
        </Text>
      </Pressable>

      {error && <Text style={{ ...typeTokens.small, color: c.warn }}>{error}</Text>}

      <PrimaryButton
        label={t('report.submit')}
        onPress={() => void continueFromForm()}
        disabled={!complete}
        busy={busy}
      />

      <LegalFooter />
    </Screen>
  )
}

/**
 * The OTP step, reached only once the numbers are already entered and held.
 *
 * Turnstile is wired here in production: signInWithOtp is unauthenticated and
 * sends mail from your domain to any address supplied. Left open it is a free
 * mail-bomb, an account-enumeration oracle, and a way to burn 3,000 free
 * emails in an afternoon (§5.1).
 */
function SignIn({
  onSignedIn,
  onBack,
  busy,
  error,
}: {
  onSignedIn: () => Promise<void>
  onBack: () => void
  busy: boolean
  error: string | null
}) {
  const c = useTheme()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  return (
    <Screen>
      <Card>
        <Text style={{ ...typeTokens.title, color: c.text }}>{t('auth.title')}</Text>
        <Text style={{ ...typeTokens.small, color: c.textMuted }}>{t('auth.why')}</Text>

        {!sent ? (
          <>
            <Label>{t('auth.email')}</Label>
            <Input
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@example.com"
            />
            <PrimaryButton
              label={t('auth.send_code')}
              onPress={async () => {
                const { error: e } = await sendOtp(email, turnstileToken())
                if (e) setLocalError(e.message)
                else setSent(true)
              }}
              disabled={!email.includes('@')}
            />
          </>
        ) : (
          <>
            <Label>{t('auth.code')}</Label>
            <Input
              value={code}
              onChangeText={(v) => setCode(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="000000"
            />
            <PrimaryButton
              label={t('auth.verify')}
              onPress={async () => {
                const { error: e } = await verifyOtp(email, code)
                if (e) setLocalError(e.message)
                else await onSignedIn()
              }}
              disabled={code.length !== 6}
              busy={busy}
            />
          </>
        )}

        {(localError ?? error) && (
          <Text style={{ ...typeTokens.small, color: c.warn }}>{localError ?? error}</Text>
        )}

        <Pressable onPress={onBack} style={{ minHeight: layout.minTapTarget, justifyContent: 'center' }}>
          <Text style={{ ...typeTokens.small, color: c.textMuted }}>Back to my report</Text>
        </Pressable>
      </Card>
      <LegalFooter />
    </Screen>
  )
}

/**
 * Turnstile renders a widget on web and hands back a token. Wire the widget in
 * the web layout and read the token here; on native the endpoint is protected
 * by the same per-email and per-IP limits.
 */
function turnstileToken(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const input = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')
  return input?.value || undefined
}

function Label({ children }: { children: string }) {
  const c = useTheme()
  return <Text style={{ ...typeTokens.small, color: c.textMuted }}>{children}</Text>
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const c = useTheme()
  return (
    <TextInput
      {...props}
      placeholderTextColor={c.textMuted}
      style={{
        // >= 16px, or iOS Safari zooms on focus and never back (§12.4).
        ...typeTokens.input,
        color: c.text,
        backgroundColor: c.surfaceMuted,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: c.border,
        paddingHorizontal: space.md,
        minHeight: layout.minTapTarget,
      }}
    />
  )
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  const c = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: layout.minTapTarget,
        justifyContent: 'center',
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: selected ? c.accent : c.border,
        backgroundColor: selected ? c.accent : c.surface,
      }}
    >
      <Text style={{ ...typeTokens.body, color: selected ? c.accentText : c.text }}>{label}</Text>
    </Pressable>
  )
}

function thisMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function locate(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(encodeGeohash(pos.coords.latitude, pos.coords.longitude, 6)),
      () => resolve(null),
      { timeout: 4000, maximumAge: 300_000 },
    )
  })
}
