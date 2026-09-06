/* global process */
import Constants from 'expo-constants'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, BackHandler, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { WebView } from 'react-native-webview'

const MAX_RETRIES = 5

const liveProductionUrl = 'https://lumen-six-nu.vercel.app/'
const fallbackHost = process.env.EXPO_PUBLIC_VITE_HOST || ''
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

const defaultWebAppUrl =
  normalizeWebAppUrl(process.env.EXPO_PUBLIC_WEB_APP_URL) ||
  (fallbackHost ? `http://${getMetroHost()}:${vitePort}/` : liveProductionUrl)

export default function ExpoWebShell() {
  const webViewRef = useRef(null)
  const [targetUrl, setTargetUrl] = useState(defaultWebAppUrl)
  const [inputUrl, setInputUrl] = useState(defaultWebAppUrl)
  const [reloadKey, setReloadKey] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [canGoBack, setCanGoBack] = useState(false)
  const canGoBackRef = useRef(false)
  const timeoutRef = useRef(null)

  const updateCanGoBack = useCallback((val) => {
    setCanGoBack(val)
    canGoBackRef.current = val
  }, [])

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      if (data && data.type === 'LUMEN_NAV_STATE') {
        if (typeof data.canGoBack === 'boolean') {
          updateCanGoBack(data.canGoBack)
        }
      }
    } catch {
      // ignore non-json messages
    }
  }, [updateCanGoBack])

  // Hardware back button support for Android
  useEffect(() => {
    const onBackPress = () => {
      if (canGoBackRef.current && webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          (function() {
            if (typeof window.__handleLumenBack === 'function') {
              window.__handleLumenBack();
            } else {
              window.history.back();
            }
          })();
          true;
        `)
        return true
      }
      return false
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress)
    return () => subscription.remove()
  }, [])

  // Safety connection timeout: If targetUrl doesn't respond in 4.5s, trigger error screen
  useEffect(() => {
    setIsLoading(true)
    setHasError(false)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(() => {
      setHasError(true)
      setIsLoading(false)
    }, 4500)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [reloadKey, targetUrl])

  const handleLoadEnd = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setHasError(false)
    setIsLoading(false)
  }, [])

  const handleError = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setHasError(true)
    setIsLoading(false)
  }, [])

  const handleManualRetry = useCallback(() => {
    const formatted = normalizeWebAppUrl(inputUrl) || targetUrl
    setTargetUrl(formatted)
    setInputUrl(formatted)
    setHasError(false)
    setIsLoading(true)
    setReloadKey((key) => key + 1)
  }, [inputUrl, targetUrl])

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <WebView
        key={reloadKey}
        ref={webViewRef}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        automaticallyAdjustContentInsets={false}
        cacheEnabled={false}
        contentInsetAdjustmentBehavior="never"
        domStorageEnabled
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        onContentProcessDidTerminate={handleError}
        onError={handleError}
        onHttpError={handleError}
        onLoadEnd={handleLoadEnd}
        onMessage={handleMessage}
        onNavigationStateChange={(navState) => {
          if (navState.canGoBack) {
            updateCanGoBack(true)
          }
        }}
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
        source={{ uri: targetUrl }}
        style={styles.webView}
      />

      {isLoading && !hasError && (
        <View style={styles.centered}>
          <ActivityIndicator color="#0071e3" size="large" />
          <Text style={styles.title}>Loading Lumen</Text>
          <Text style={styles.url}>{targetUrl}</Text>
        </View>
      )}

      {hasError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorBadge}>DISCONNECTED</Text>
          <Text style={styles.title}>Vite is not reachable</Text>
          <Text style={styles.url}>{targetUrl}</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Dev Server / Web App URL:</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onChangeText={setInputUrl}
              placeholder="e.g. 192.168.31.5:5173"
              placeholderTextColor="#6e6e73"
              style={styles.input}
              value={inputUrl}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleManualRetry}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Retry Connection</Text>
          </TouchableOpacity>

          <View style={styles.tipsContainer}>
            <Text style={styles.tipHeader}>Troubleshooting Checklist:</Text>
            <Text style={styles.tipText}>1. Start server on PC with: <Text style={styles.boldText}>npm run dev</Text></Text>
            <Text style={styles.tipText}>2. Ensure phone & PC are on the same Wi-Fi</Text>
            <Text style={styles.tipText}>3. Verify PC IP address (currently 192.168.31.5)</Text>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  boldText: {
    color: '#0071e3',
    fontWeight: '600',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#000',
    bottom: 0,
    gap: 12,
    justifyContent: 'center',
    left: 0,
    padding: 24,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  container: {
    backgroundColor: '#000',
    flex: 1,
  },
  errorBadge: {
    backgroundColor: 'rgba(255, 69, 58, 0.2)',
    borderRadius: 6,
    color: '#ff453a',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  errorOverlay: {
    alignItems: 'center',
    backgroundColor: '#0a0a0c',
    bottom: 0,
    gap: 14,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 28,
    paddingVertical: 36,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 20,
  },
  input: {
    backgroundColor: '#1c1c1e',
    borderColor: '#3a3a3c',
    borderRadius: 10,
    borderWidth: 1,
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
  },
  inputContainer: {
    gap: 6,
    marginVertical: 4,
    width: '100%',
  },
  inputLabel: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '500',
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: '#0071e3',
    borderRadius: 10,
    paddingVertical: 12,
    width: '100%',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  tipHeader: {
    color: '#86868b',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  tipText: {
    color: '#a1a1aa',
    fontSize: 12,
    lineHeight: 18,
  },
  tipsContainer: {
    backgroundColor: '#161618',
    borderRadius: 10,
    gap: 4,
    marginTop: 8,
    padding: 14,
    width: '100%',
  },
  title: {
    color: '#f5f5f7',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  url: {
    color: '#86868b',
    fontSize: 13,
    textAlign: 'center',
  },
  webView: {
    backgroundColor: '#000',
    flex: 1,
  },
})
