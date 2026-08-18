import { Pressable, Text, View } from 'react-native'
import { layout, radius, space, type as typeTokens, useTheme } from '@/theme'
import { LOCALES, setLocale, t, useLocale, type Locale } from '@/lib/i18n'

/**
 * On sign-in and in settings, never buried (§12.3).
 *
 * Language names are written in their own script — someone who cannot read the
 * current interface language cannot find "Kannada" spelled in English.
 */
export function LanguagePicker() {
  const c = useTheme()
  const locale = useLocale()

  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ ...typeTokens.small, color: c.textMuted }}>{t('common.language')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(Object.keys(LOCALES) as Locale[]).map((code) => {
          const selected = code === locale
          return (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setLocale(code)}
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
              <Text style={{ ...typeTokens.body, color: selected ? c.accentText : c.text }}>
                {LOCALES[code]}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
