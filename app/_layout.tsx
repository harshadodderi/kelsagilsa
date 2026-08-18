import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useEffect } from 'react'
import { getLocales } from 'expo-localization'
import { ThemeProvider, useTheme } from '@/theme'
import { isLocale, setLocale, storedLocale, useLocale } from '@/lib/i18n'

function Shell() {
  const c = useTheme()

  // Subscribing here is what makes the language picker repaint the screens
  // below it — `t()` reads a module-level variable that React cannot see.
  useLocale()

  useEffect(() => {
    // A choice already made wins over the device language. Otherwise follow
    // the device, and let the picker on sign-in and in settings override it —
    // never buried (§12.3).
    const chosen = storedLocale()
    if (chosen) {
      setLocale(chosen)
      return
    }
    const preferred = getLocales()[0]?.languageCode
    if (isLocale(preferred)) setLocale(preferred)
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
        {/*
          Without these, a dynamic route shows its own path in the header —
          "prices/[city]/[job]". Each page already carries its full context in
          an h1, so the header stays short and the back button stays obvious.
        */}
        <Stack.Screen name="index" options={{ title: 'Kelsagilsa' }} />
        <Stack.Screen name="report" options={{ title: 'Add what you paid' }} />
        <Stack.Screen name="prices/[city]/index" options={{ title: 'Prices' }} />
        <Stack.Screen name="prices/[city]/[job]" options={{ title: 'Prices' }} />
        <Stack.Screen name="legal/terms" options={{ title: 'Terms' }} />
        <Stack.Screen name="legal/privacy" options={{ title: 'Privacy' }} />
        <Stack.Screen name="legal/grievance" options={{ title: 'Grievance officer' }} />
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
