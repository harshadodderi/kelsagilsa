import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { layout, radius, space, type as typeTokens, useTheme } from '@/theme'
import { t } from '@/lib/i18n'

/**
 * Phones are one column, content capped at ~440px centred on desktop, and
 * `env(safe-area-inset-bottom)` respected (§12.4).
 */
export function Screen({ children }: { children: ReactNode }) {
  const c = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{
        paddingHorizontal: space.md,
        paddingTop: space.lg,
        paddingBottom: space.xxl + insets.bottom,
        alignItems: 'center',
      }}
    >
      <View style={{ width: '100%', maxWidth: layout.maxContentWidth, gap: space.lg }}>
        {children}
      </View>
    </ScrollView>
  )
}

export function Card({ children }: { children: ReactNode }) {
  const c = useTheme()
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderColor: c.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: space.md,
        gap: space.sm,
      }}
    >
      {children}
    </View>
  )
}

/** One primary action per screen (§12.1). No hover-only affordances. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  busy?: boolean
}) {
  const c = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={{
        minHeight: layout.minTapTarget,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: radius.md,
        paddingHorizontal: space.lg,
        backgroundColor: disabled ? c.surfaceMuted : c.accent,
        opacity: busy ? 0.7 : 1,
      }}
    >
      {busy ? (
        <ActivityIndicator color={c.accentText} />
      ) : (
        <Text style={{ ...typeTokens.body, fontWeight: '600', color: disabled ? c.textMuted : c.accentText }}>
          {label}
        </Text>
      )}
    </Pressable>
  )
}

/**
 * Every screen gets an empty, loading and error state as it is built — not at
 * the end (§12.4).
 */
export function Loading() {
  const c = useTheme()
  return (
    <View style={{ paddingVertical: space.xl, alignItems: 'center', gap: space.sm }}>
      <ActivityIndicator color={c.accent} />
      <Text style={{ ...typeTokens.small, color: c.textMuted }}>{t('common.loading')}</Text>
    </View>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useTheme()
  return (
    <Card>
      <Text style={{ ...typeTokens.body, color: c.text }}>{message}</Text>
      {onRetry && <PrimaryButton label={t('common.retry')} onPress={onRetry} />}
    </Card>
  )
}
