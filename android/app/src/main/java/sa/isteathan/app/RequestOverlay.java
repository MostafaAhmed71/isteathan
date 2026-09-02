package sa.isteathan.app;

import android.content.Context;
import android.graphics.PixelFormat;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;
import androidx.appcompat.view.ContextThemeWrapper;
import java.util.List;

public class RequestOverlay {
    private final Context app;
    private final Handler main = new Handler(Looper.getMainLooper());
    private View view;
    private WindowManager.LayoutParams params;
    private boolean hiddenUntilNew = false;

    public RequestOverlay(Context context) {
        this.app = context.getApplicationContext();
    }

    public boolean canDraw() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(app);
    }

    public void show(List<String> names, boolean playSound) {
        main.post(() -> {
            if (names == null || names.isEmpty()) {
                hideInternal();
                hiddenUntilNew = false;
                return;
            }
            if (hiddenUntilNew && !playSound) return;
            if (!canDraw()) return;
            hiddenUntilNew = false;
            attach(names);
            if (playSound) alertUser();
        });
    }

    public void hide() {
        main.post(this::hideInternal);
    }

    private void attach(List<String> names) {
        WindowManager wm = (WindowManager) app.getSystemService(Context.WINDOW_SERVICE);
        if (wm == null) return;
        if (view == null) {
            Context themed = new ContextThemeWrapper(app, R.style.AppTheme);
            view = LayoutInflater.from(themed).inflate(R.layout.overlay_request, null);
            params = buildParams();
            enableDrag(view.findViewById(R.id.overlay_kicker));
            enableDrag(view.findViewById(R.id.overlay_title));
            view.findViewById(R.id.overlay_hide).setOnClickListener(v -> {
                hiddenUntilNew = true;
                hideInternal();
            });
            view.findViewById(R.id.overlay_open).setOnClickListener(v -> {
                hideInternal();
                app.startActivity(MainActivity.openIntent(app, MainActivity.CLASS_DISPLAY_PATH));
            });
            try {
                wm.addView(view, params);
            } catch (Exception err) {
                android.util.Log.w("IsteathanOverlay", "addView failed", err);
                view = null;
                return;
            }
        }
        TextView body = view.findViewById(R.id.overlay_body);
        body.setText(formatNames(names));
        TextView title = view.findViewById(R.id.overlay_title);
        title.setText(
            names.size() == 1
                ? app.getString(R.string.alert_new_title)
                : app.getString(R.string.overlay_title_many, names.size())
        );
        if (view.getWindowToken() == null) {
            try {
                wm.addView(view, params);
            } catch (Exception ignored) {}
        }
    }

    private void hideInternal() {
        if (view == null) return;
        WindowManager wm = (WindowManager) app.getSystemService(Context.WINDOW_SERVICE);
        if (wm != null) {
            try {
                wm.removeViewImmediate(view);
            } catch (Exception ignored) {}
        }
        view = null;
    }

    private WindowManager.LayoutParams buildParams() {
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        );
        lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        lp.y = 48;
        return lp;
    }

    private void enableDrag(View target) {
        target.setOnTouchListener(new View.OnTouchListener() {
            private int startX;
            private int startY;
            private float touchX;
            private float touchY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                if (params == null) return false;
                WindowManager wm = (WindowManager) app.getSystemService(Context.WINDOW_SERVICE);
                if (wm == null) return false;
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        startX = params.x;
                        startY = params.y;
                        touchX = event.getRawX();
                        touchY = event.getRawY();
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        params.x = startX + (int) (event.getRawX() - touchX);
                        params.y = startY + (int) (event.getRawY() - touchY);
                        try {
                            wm.updateViewLayout(view, params);
                        } catch (Exception ignored) {}
                        return true;
                    default:
                        return false;
                }
            }
        });
    }

    private void alertUser() {
        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            Ringtone ringtone = RingtoneManager.getRingtone(app, uri);
            if (ringtone != null) {
                ringtone.play();
                main.postDelayed(() -> {
                    try {
                        ringtone.stop();
                    } catch (Exception ignored) {}
                }, 2500);
            }
        } catch (Exception ignored) {
            try {
                ToneGenerator tone = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
                tone.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 700);
                main.postDelayed(tone::release, 900);
            } catch (Exception ignored2) {}
        }
        try {
            Vibrator vibrator = (Vibrator) app.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(new long[] { 0, 250, 120, 250, 120, 400 }, -1));
            } else {
                vibrator.vibrate(new long[] { 0, 250, 120, 250, 120, 400 }, -1);
            }
        } catch (Exception ignored) {}
    }

    private String formatNames(List<String> names) {
        StringBuilder sb = new StringBuilder();
        int limit = Math.min(names.size(), 6);
        for (int i = 0; i < limit; i++) {
            if (i > 0) sb.append('\n');
            sb.append("• ").append(names.get(i));
        }
        if (names.size() > limit) {
            sb.append('\n').append(app.getString(R.string.overlay_more, names.size() - limit));
        }
        return sb.toString();
    }
}
