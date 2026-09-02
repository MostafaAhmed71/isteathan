package sa.isteathan.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundMonitor")
public class BackgroundMonitorPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor editor = ctx
            .getSharedPreferences(BackgroundMonitorService.PREFS, Context.MODE_PRIVATE)
            .edit();
        editor.putBoolean("enabled", true);
        editor.putString("supabaseUrl", call.getString("supabaseUrl", ""));
        editor.putString("anonKey", call.getString("anonKey", ""));
        editor.putString("accessToken", call.getString("accessToken", ""));
        editor.putString("refreshToken", call.getString("refreshToken", ""));
        editor.putString("userId", call.getString("userId", ""));
        editor.putString("role", call.getString("role", ""));
        editor.putString("classId", call.getString("classId", ""));
        editor.apply();

        Intent intent = new Intent(ctx, BackgroundMonitorService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(intent);
        } else {
            ctx.startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences(BackgroundMonitorService.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean("enabled", false)
            .apply();
        ctx.stopService(new Intent(ctx, BackgroundMonitorService.class));
        call.resolve();
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        Context ctx = getContext();
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        boolean unrestricted =
            pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
        if (!unrestricted) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + ctx.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
            } catch (Exception ignored) {
                Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(fallback);
            }
        }
        JSObject result = new JSObject();
        result.put("unrestricted", unrestricted);
        call.resolve(result);
    }

    @PluginMethod
    public void consumeLaunchPath(PluginCall call) {
        SharedPreferences prefs = getContext()
            .getSharedPreferences(BackgroundMonitorService.PREFS, Context.MODE_PRIVATE);
        String path = prefs.getString("launchPath", "");
        prefs.edit().remove("launchPath").apply();
        JSObject result = new JSObject();
        result.put("path", path == null || path.isEmpty() ? "" : path);
        call.resolve(result);
    }

    @PluginMethod
    public void checkOverlayPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", canDrawOverlays());
        call.resolve(result);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(ctx)) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + ctx.getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
        }
        JSObject result = new JSObject();
        result.put("granted", canDrawOverlays());
        call.resolve(result);
    }

    private boolean canDrawOverlays() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
            Settings.canDrawOverlays(getContext());
    }
}
