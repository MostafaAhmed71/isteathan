import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

export async function bootstrapNativeApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

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

  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back()
    } else {
      void App.exitApp()
    }
  })
}
