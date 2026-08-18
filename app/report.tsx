import { useEffect, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Card, PrimaryButton, Screen } from '@/components/Screen'
import { LegalFooter } from '@/components/LegalFooter'
import { LanguagePicker } from '@/components/LanguagePicker'
import { Turnstile } from '@/components/Turnstile'
import { PriceFigure } from '@/components/PriceFigure'
import { layout, radius, space, type as typeTokens, useTheme } from '@/theme'
import { compareToBenchmark, submitBookingLessReport, type Comparison } from '@/lib/api'
import { supabase, sendOtp, verifyOtp } from '@/lib/supabase'
import { encodeGeohash } from '@/lib/geohash'
import { userFacingMessage } from '@/lib/errors'
import { rupees } from '@/lib/money'
import { t } from '@/lib/i18n'
import { JOB_TYPES, jobTypeName } from '@/data/launch-set'

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
  // `k` is the attribution token from a link sent personally (§13.1). Its
  // absence is what makes a report organic, so it is read here and nowhere
  // else — a default of 'organic' that a query parameter can override.
  const { job, k } = useLocalSearchParams<{ job?: string; k?: string }>()
  const c = useTheme()

  const [draft, setDraft] = useState<Draft>({
    jobSlug: job && JOB_TYPES.some((j) => j.slug === job) ? job : (JOB_TYPES[0]?.slug ?? ''),
    amountPaid: '',
    partsAnswer: 'unsure',
    partsAmount: '',
    occurredOn: thisMonth(),
    areaGeohash: null,
    nameInPublicFeed: false,
  })

  const [stage, setStage] = useState<Stage>('form')
  const [showOlderMonths, setShowOlderMonths] = useState(false)
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
        solicitToken: k ?? null,
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
            {t('payback.you_paid', {
              amount: rupees(amount),
              jobType: jobTypeName(draft.jobSlug).toLowerCase(),
            })}
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
          {/* The words people actually used, not the slug (§2.5). */}
          {JOB_TYPES.map((jobType) => (
            <Chip
              key={jobType.slug}
              label={
                jobType.sizeQualifier
                  ? `${jobType.name} — ${jobType.sizeQualifier}`
                  : jobType.name
              }
              selected={draft.jobSlug === jobType.slug}
              onPress={() => setDraft({ ...draft, jobSlug: jobType.slug })}
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
        {/*
          Month precision, and a picker rather than a text field: "roughly
          when" is the question, typing YYYY-MM is not an answer anyone should
          have to compose on a phone. Only the last 12 months are offered,
          because older reports are refused anyway (§7.6) — offering them and
          then rejecting them wastes the person's time.
        */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {recentMonths(showOlderMonths ? 12 : 4).map((month) => (
            <Chip
              key={month.value}
              label={month.label}
              selected={draft.occurredOn === month.value}
              onPress={() => setDraft({ ...draft, occurredOn: month.value })}
            />
          ))}
          {!showOlderMonths && (
            <Chip label="Earlier" selected={false} onPress={() => setShowOlderMonths(true)} />
          )}
        </View>
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
 * The Turnstile token obtained here travels to the send-otp edge function,
 * which applies the per-email and per-IP limits and writes the send log before
 * forwarding to GoTrue. Left open, this endpoint is a free mail-bomb, an
 * account-enumeration oracle, and a way to burn 3,000 free emails in an
 * afternoon (§5.1).
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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

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
            <Turnstile onToken={setCaptchaToken} />
            <PrimaryButton
              label={t('auth.send_code')}
              onPress={async () => {
                setSending(true)
                setLocalError(null)
                const { error: e } = await sendOtp(email, captchaToken ?? undefined)
                setSending(false)
                if (e) setLocalError(e.message)
                else setSent(true)
              }}
              disabled={!email.includes('@')}
              busy={sending}
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

      {/* On sign-in, never buried (§12.3). */}
      <LanguagePicker />
      <LegalFooter />
    </Screen>
  )
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

/**
 * The months a report may cover, most recent first. The first two are named
 * rather than dated, because that is how people answer the question.
 */
function recentMonths(count: number): { value: string; label: string }[] {
  const now = new Date()
  return Array.from({ length: count }, (_, back) => {
    const date = new Date(now.getFullYear(), now.getMonth() - back, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label =
      back === 0
        ? 'This month'
        : back === 1
          ? 'Last month'
          : date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    return { value, label }
  })
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
