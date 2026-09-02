import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'

type NativePermission = 'granted' | 'denied' | 'default' | 'unsupported'

export const NATIVE_ALERT_CHANNEL = 'isteathan-alerts'

function mapDisplay(display: string): NativePermission {
  if (display === 'granted') return 'granted'
  if (display === 'denied') return 'denied'
  return 'default'
}

export async function ensureNativeAlertChannel(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  try {
    await LocalNotifications.createChannel({
      id: NATIVE_ALERT_CHANNEL,
      name: 'تنبيهات الخروج',
      description: 'طلبات الخروج وردود الإدارة',
      importance: 5,
      visibility: 1,
      vibration: true,
    })
  } catch {
    // Channel creation is best-effort; default channel still works.
  }
}

export async function checkNativeNotificationPermission(): Promise<NativePermission> {
  try {
    const status = await LocalNotifications.checkPermissions()
    return mapDisplay(status.display)
  } catch {
    return 'unsupported'
  }
}

export async function requestNativeNotificationPermission(): Promise<NativePermission> {
  try {
    await ensureNativeAlertChannel()
    const status = await LocalNotifications.requestPermissions()
    return mapDisplay(status.display)
  } catch {
    return 'unsupported'
  }
}

export async function showNativeNotification(
  title: string,
  body: string,
  url = '/',
): Promise<boolean> {
  try {
    const permission = await checkNativeNotificationPermission()
    if (permission !== 'granted') return false
    await ensureNativeAlertChannel()
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 2147483647),
          title,
          body,
          channelId: NATIVE_ALERT_CHANNEL,
          extra: { url },
          autoCancel: true,
          schedule: { at: new Date(Date.now() + 250), allowWhileIdle: true },
        },
      ],
    })
    return true
  } catch (err) {
    console.error('native notification failed', err)
    return false
  }
}

export async function listenNativeNotificationTaps(): Promise<void> {
  try {
    await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const extra = event.notification.extra as { url?: unknown } | undefined
      const url = extra?.url
      if (typeof url === 'string' && url.startsWith('/')) {
        window.location.assign(url)
      }
    })
  } catch {
    // Listener is optional.
  }
}
