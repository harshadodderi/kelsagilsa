import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useEffect } from 'react'
import { getLocales } from 'expo-localization'
import { ThemeProvider, useTheme } from '@/theme'
import { setLocale, type Locale } from '@/lib/i18n'

function Shell() {
  const c = useTheme()

  useEffect(() => {
    // Follow the device, and let the picker on sign-in and in settings
    // override it — never buried (§12.3).
    const preferred = getLocales()[0]?.languageCode
    if (preferred === 'kn' || preferred === 'hi' || preferred === 'en') {
      setLocale(preferred as Locale)
    }
  }, [])

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.background },
          headerTintColor: c.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Kelsagilsa' }} />
        <Stack.Screen name="report" options={{ title: 'Add what you paid' }} />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
