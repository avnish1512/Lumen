/* global process */
import Constants from 'expo-constants'
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'

const fallbackHost = process.env.EXPO_PUBLIC_VITE_HOST || '192.168.31.5'
const vitePort = process.env.EXPO_PUBLIC_VITE_PORT || '5173'

function normalizeWebAppUrl(value) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return ''
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`

  return withProtocol.endsWith('/') ? withProtocol : `${withProtocol}/`
}

function getMetroHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost ||
    ''

  return hostUri ? hostUri.split(':')[0] : fallbackHost
}

const webAppUrl =
  normalizeWebAppUrl(process.env.EXPO_PUBLIC_WEB_APP_URL) ||
  `http://${getMetroHost()}:${vitePort}/`

function LoadingView() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color="#f5f5f7" size="large" />
      <Text style={styles.title}>Loading Apple Clone</Text>
      <Text style={styles.url}>{webAppUrl}</Text>
    </View>
  )
}

function ErrorView() {
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Vite is not reachable</Text>
      <Text style={styles.url}>{webAppUrl}</Text>
    </View>
  )
}

export default function ExpoWebShell() {
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <WebView
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        domStorageEnabled
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        originWhitelist={['*']}
        renderError={ErrorView}
        renderLoading={LoadingView}
        setSupportMultipleWindows={false}
        source={{ uri: webAppUrl }}
        startInLoadingState
        style={styles.webView}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: '#000',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: '#000',
    flex: 1,
  },
  title: {
    color: '#f5f5f7',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  url: {
    color: '#a1a1aa',
    fontSize: 12,
    textAlign: 'center',
  },
  webView: {
    backgroundColor: '#000',
    flex: 1,
  },
})
