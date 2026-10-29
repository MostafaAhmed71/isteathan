package sa.isteathan.overlay

import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.core.content.ContextCompat

class FloatingOverlay(private val context: Context) {
    private val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val main = Handler(Looper.getMainLooper())
    private var view: View? = null
    private var hideRunnable: Runnable? = null
    var currentRequestId: String? = null
        private set

    fun show(row: PermissionRow, bandText: String, autoHideMs: Long = 20_000L) {
        main.post {
            ensureView()
            val root = view ?: return@post
            val band = root.findViewById<TextView>(R.id.overlayBand)
            val name = root.findViewById<TextView>(R.id.overlayName)
            val klass = root.findViewById<TextView>(R.id.overlayClass)
            val status = root.findViewById<TextView>(R.id.overlayStatus)

            currentRequestId = row.id
            name.text = row.studentName
            klass.text = row.classLabel.ifBlank { "—" }
            band.text = bandText
            status.text = statusLabel(row.status)
            applyTone(band, status, row.status)

            if (root.parent == null) {
                wm.addView(root, layoutParams())
            }

            hideRunnable?.let { main.removeCallbacks(it) }
            if (autoHideMs > 0) {
                hideRunnable = Runnable { hide() }
                main.postDelayed(hideRunnable!!, autoHideMs)
            }
        }
    }

    fun updateStatus(row: PermissionRow, bandText: String) {
        main.post {
            if (currentRequestId != row.id) {
                show(row, bandText, autoHideMs = 12_000L)
                return@post
            }
            val root = view ?: return@post
            val band = root.findViewById<TextView>(R.id.overlayBand)
            val status = root.findViewById<TextView>(R.id.overlayStatus)
            band.text = bandText
            status.text = statusLabel(row.status)
            applyTone(band, status, row.status)
            hideRunnable?.let { main.removeCallbacks(it) }
            hideRunnable = Runnable { hide() }
            main.postDelayed(hideRunnable!!, 12_000L)
        }
    }

    fun hide() {
        main.post {
            hideRunnable?.let { main.removeCallbacks(it) }
            hideRunnable = null
            val root = view ?: return@post
            if (root.parent != null) {
                runCatching { wm.removeView(root) }
            }
            currentRequestId = null
        }
    }

    fun destroy() {
        hide()
        view = null
    }

    private fun ensureView() {
        if (view != null) return
        val root = LayoutInflater.from(context).inflate(R.layout.overlay_panel, null)
        root.findViewById<Button>(R.id.overlayDismiss).setOnClickListener { hide() }
        view = root
    }

    private fun layoutParams(): WindowManager.LayoutParams {
        val type =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }
        return WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = 48
        }
    }

    private fun statusLabel(status: String): String =
        when (status) {
            "APPROVED" -> context.getString(R.string.approved)
            "REJECTED" -> context.getString(R.string.rejected)
            else -> context.getString(R.string.waiting)
        }

    private fun applyTone(band: TextView, status: TextView, requestStatus: String) {
        val colorRes =
            when (requestStatus) {
                "APPROVED" -> R.color.approved
                "REJECTED" -> R.color.rejected
                else -> R.color.pending
            }
        val color = ContextCompat.getColor(context, colorRes)
        band.setBackgroundColor(color)
        status.setBackgroundColor(color)
        val onColor =
            if (requestStatus == "PENDING") {
                ContextCompat.getColor(context, R.color.bg)
            } else {
                ContextCompat.getColor(context, android.R.color.white)
            }
        band.setTextColor(onColor)
        status.setTextColor(onColor)
    }
}
