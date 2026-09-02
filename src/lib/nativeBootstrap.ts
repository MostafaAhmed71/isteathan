import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { consumeNativeLaunchPath } from './backgroundMonitor'
import {
  ensureNativeAlertChannel,
  listenNativeNotificationTaps,
  requestNativeNotificationPermission,
} from './nativeNotifications'

export async function bootstrapNativeApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const launchPath = await consumeNativeLaunchPath()
  if (launchPath && window.location.pathname !== launchPath) {
    window.location.replace(launchPath)
    return
  }

  try {
    await StatusBar.setStyle({ style: Style.Light })
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0b1f3f' })
    }
  } catch {
    // StatusBar is optional in web preview / missing plugin.
  }

  try {
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body })
  } catch {
    // Keyboard plugin is optional.
  }

  try {
    await SplashScreen.hide()
  } catch {
    // SplashScreen plugin is optional.
  }

  try {
    await ensureNativeAlertChannel()
    await listenNativeNotificationTaps()
    await requestNativeNotificationPermission()
  } catch {
    // Notification permission is requested again from «تفعيل الإشعارات».
  }

  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back()
    } else {
      void App.exitApp()
    }
  })

  void App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return
    void consumeNativeLaunchPath().then((path) => {
      if (!path || window.location.pathname === path) return
      window.dispatchEvent(new CustomEvent('isteathan:navigate', { detail: path }))
    })
  })
}
