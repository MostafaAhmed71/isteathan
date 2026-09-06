package sa.isteathan.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    @PluginMethod
    public void getVersionInfo(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            String pkg = getContext().getPackageName();
            android.content.pm.PackageInfo info = pm.getPackageInfo(pkg, 0);
            int versionCode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                versionCode = (int) info.getLongVersionCode();
            } else {
                versionCode = info.versionCode;
            }
            String versionName = info.versionName;
            JSObject result = new JSObject();
            result.put("versionCode", versionCode);
            result.put("versionName", versionName == null ? "" : versionName);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("version_info_failed", e);
        }
    }

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            result.put("granted", getContext().getPackageManager().canRequestPackageInstalls());
        } else {
            result.put("granted", true);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void requestInstallPermission(PluginCall call) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !getContext().getPackageManager().canRequestPackageInstalls()
        ) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        JSObject result = new JSObject();
        result.put(
            "granted",
            Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
                getContext().getPackageManager().canRequestPackageInstalls()
        );
        call.resolve(result);
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("missing_url");
            return;
        }

        new Thread(() -> {
            try {
                notifyProgress(0);
                File cacheDir = getContext().getCacheDir();
                File apkFile = new File(cacheDir, "app-update.apk");
                if (apkFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    apkFile.delete();
                }

                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(30000);
                conn.setReadTimeout(180000);
                conn.connect();

                int total = conn.getContentLength();
                InputStream in = conn.getInputStream();
                FileOutputStream out = new FileOutputStream(apkFile);
                byte[] buffer = new byte[8192];
                int read;
                int downloaded = 0;
                while ((read = in.read(buffer)) != -1) {
                    downloaded += read;
                    out.write(buffer, 0, read);
                    if (total > 0) {
                        int pct = (int) ((downloaded * 100L) / total);
                        notifyProgress(pct);
                    }
                }
                out.flush();
                out.close();
                in.close();
                conn.disconnect();
                notifyProgress(100);

                getActivity().runOnUiThread(() -> {
                    try {
                        installApk(apkFile);
                        call.resolve();
                    } catch (Exception e) {
                        call.reject("install_failed", e);
                    }
                });
            } catch (Exception e) {
                call.reject("download_failed", e);
            }
        }).start();
    }

    private void notifyProgress(int percent) {
        JSObject data = new JSObject();
        data.put("percent", percent);
        notifyListeners("downloadProgress", data);
    }

    private void installApk(File apkFile) {
        Uri uri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apkFile
        );
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }
}
