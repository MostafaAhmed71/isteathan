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
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;
import androidx.appcompat.view.ContextThemeWrapper;
import java.util.ArrayList;
import java.util.List;

public class RequestOverlay {
    public static final class PendingItem {
        public final String id;
        public final String name;

        public PendingItem(String id, String name) {
            this.id = id;
            this.name = name;
        }
    }

    public interface ApproveListener {
        void onApprove(String requestId, String studentName);
    }

    private final Context app;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ApproveListener approveListener;
    private View view;
    private WindowManager.LayoutParams params;
    private boolean hiddenUntilNew = false;
    private boolean approving = false;
    private List<PendingItem> currentItems = new ArrayList<>();

    public RequestOverlay(Context context, ApproveListener approveListener) {
        this.app = context.getApplicationContext();
        this.approveListener = approveListener;
    }

    public boolean canDraw() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(app);
    }

    public void show(List<PendingItem> items, boolean playSound) {
        main.post(() -> {
            if (items == null || items.isEmpty()) {
                hideInternal();
                hiddenUntilNew = false;
                approving = false;
                currentItems = new ArrayList<>();
                return;
            }
            if (hiddenUntilNew && !playSound) return;
            if (!canDraw()) return;
            hiddenUntilNew = false;
            currentItems = new ArrayList<>(items);
            attach(currentItems);
            if (playSound) alertUser();
        });
    }

    public void hide() {
        main.post(this::hideInternal);
    }

    public void setApproving(boolean busy) {
        main.post(() -> {
            approving = busy;
            if (view == null) return;
            TextView approve = view.findViewById(R.id.overlay_approve);
            TextView status = view.findViewById(R.id.overlay_status);
            approve.setEnabled(!busy);
            approve.setAlpha(busy ? 0.55f : 1f);
            approve.setText(busy
                ? app.getString(R.string.overlay_approving)
                : app.getString(R.string.overlay_approve));
            if (busy) {
                status.setVisibility(View.VISIBLE);
                status.setText(app.getString(R.string.overlay_approving));
            }
        });
    }

    public void showStatus(String message) {
        main.post(() -> {
            if (view == null) return;
            TextView status = view.findViewById(R.id.overlay_status);
            status.setVisibility(View.VISIBLE);
            status.setText(message);
        });
    }

    private void attach(List<PendingItem> items) {
        WindowManager wm = (WindowManager) app.getSystemService(Context.WINDOW_SERVICE);
        if (wm == null) return;
        if (view == null) {
            Context themed = new ContextThemeWrapper(app, R.style.AppTheme);
            view = LayoutInflater.from(themed).inflate(R.layout.overlay_request, null);
            params = buildParams();
            enableDrag(view.findViewById(R.id.overlay_kicker));
            enableDrag(view.findViewById(R.id.overlay_title));
            enableDrag(view.findViewById(R.id.overlay_primary));
            view.findViewById(R.id.overlay_hide).setOnClickListener(v -> {
                hiddenUntilNew = true;
                hideInternal();
            });
            view.findViewById(R.id.overlay_open).setOnClickListener(v -> {
                hideInternal();
                app.startActivity(MainActivity.openIntent(app, MainActivity.CLASS_DISPLAY_PATH));
            });
            view.findViewById(R.id.overlay_approve).setOnClickListener(v -> {
                if (approving || currentItems.isEmpty() || approveListener == null) return;
                PendingItem first = currentItems.get(0);
                setApproving(true);
                approveListener.onApprove(first.id, first.name);
            });
            try {
                wm.addView(view, params);
            } catch (Exception err) {
                android.util.Log.w("IsteathanOverlay", "addView failed", err);
                view = null;
                return;
            }
        }
        bindContent(items);
        if (view.getWindowToken() == null) {
            try {
                wm.addView(view, params);
            } catch (Exception ignored) {}
        }
    }

    private void bindContent(List<PendingItem> items) {
        if (view == null || items.isEmpty()) return;
        PendingItem first = items.get(0);
        TextView title = view.findViewById(R.id.overlay_title);
        TextView primary = view.findViewById(R.id.overlay_primary);
        TextView body = view.findViewById(R.id.overlay_body);
        TextView approve = view.findViewById(R.id.overlay_approve);
        TextView status = view.findViewById(R.id.overlay_status);

        title.setText(
            items.size() == 1
                ? app.getString(R.string.alert_new_title)
                : app.getString(R.string.overlay_title_many, items.size())
        );
        primary.setText(first.name);
        body.setText(formatOthers(items));
        if (!approving) {
            approve.setEnabled(true);
            approve.setAlpha(1f);
            approve.setText(app.getString(R.string.overlay_approve));
            status.setVisibility(View.GONE);
            status.setText("");
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
        approving = false;
    }

    private WindowManager.LayoutParams buildParams() {
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        DisplayMetrics metrics = app.getResources().getDisplayMetrics();
        // Compact card — stays readable without covering the lesson.
        int width = Math.min((int) (320 * metrics.density), (int) (metrics.widthPixels * 0.42f));
        width = Math.max(width, (int) (260 * metrics.density));
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
            width,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        );
        lp.gravity = Gravity.TOP | Gravity.END;
        lp.x = 16;
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

    private String formatOthers(List<PendingItem> items) {
        if (items.size() <= 1) return "";
        StringBuilder sb = new StringBuilder();
        int limit = Math.min(items.size(), 3);
        for (int i = 1; i < limit; i++) {
            if (i > 1) sb.append('\n');
            sb.append("• ").append(items.get(i).name);
        }
        if (items.size() > limit) {
            if (sb.length() > 0) sb.append('\n');
            sb.append(app.getString(R.string.overlay_more, items.size() - limit));
        }
        return sb.toString();
    }
}
