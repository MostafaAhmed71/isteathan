package sa.isteathan.overlay

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        val prefs = Prefs(context)
        if (!prefs.serviceEnabled || !prefs.isLoggedIn()) return
        val canDraw =
            Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)
        if (!canDraw) return
        OverlayService.start(context)
    }
}
