package sa.isteathan.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class MonitorBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        if (
            !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) &&
            !Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(intent.getAction())
        ) {
            return;
        }
        boolean enabled = context
            .getSharedPreferences(BackgroundMonitorService.PREFS, Context.MODE_PRIVATE)
            .getBoolean("enabled", false);
        if (!enabled) return;
        Intent service = new Intent(context, BackgroundMonitorService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(service);
        } else {
            context.startService(service);
        }
    }
}
