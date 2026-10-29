package sa.isteathan.overlay

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton

class MainActivity : AppCompatActivity() {
    private lateinit var prefs: Prefs
    private lateinit var statusView: TextView

    private val notifPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            refreshUi()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        if (!prefs.isLoggedIn()) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }
        setContentView(R.layout.activity_main)
        statusView = findViewById(R.id.textServiceStatus)

        findViewById<TextView>(R.id.textStaffName).text = prefs.staffName
        findViewById<TextView>(R.id.textClassInfo).text = prefs.classLabel

        findViewById<MaterialButton>(R.id.btnOverlayPermission).setOnClickListener {
            openOverlaySettings()
        }
        findViewById<MaterialButton>(R.id.btnNotifPermission).setOnClickListener {
            requestNotifPermission()
        }
        findViewById<MaterialButton>(R.id.btnStart).setOnClickListener {
            if (!canDrawOverlays()) {
                Toast.makeText(this, "امنح صلاحية الظهور فوق التطبيقات أولاً", Toast.LENGTH_LONG)
                    .show()
                openOverlaySettings()
                return@setOnClickListener
            }
            requestNotifPermission()
            OverlayService.start(this)
            prefs.serviceEnabled = true
            refreshUi()
            Toast.makeText(this, R.string.service_running, Toast.LENGTH_SHORT).show()
        }
        findViewById<MaterialButton>(R.id.btnStop).setOnClickListener {
            OverlayService.stop(this)
            prefs.serviceEnabled = false
            refreshUi()
        }
        findViewById<MaterialButton>(R.id.btnLogout).setOnClickListener {
            OverlayService.stop(this)
            prefs.clearSession()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }

    override fun onResume() {
        super.onResume()
        refreshUi()
        if (prefs.serviceEnabled && canDrawOverlays()) {
            OverlayService.start(this)
        }
    }

    private fun refreshUi() {
        val overlayOk = canDrawOverlays()
        val running = prefs.serviceEnabled
        statusView.text =
            buildString {
                append(if (running) getString(R.string.service_running) else getString(R.string.service_stopped))
                append('\n')
                append(if (overlayOk) "صلاحية النافذة العائمة: ممنوحة" else "صلاحية النافذة العائمة: غير ممنوحة")
            }
        findViewById<TextView>(R.id.textHint).text =
            if (!overlayOk) {
                "على Maxhub/BenQ: الإعدادات → التطبيقات → الظهور فوق التطبيقات → استئذان"
            } else {
                getString(R.string.status_ok)
            }
    }

    private fun canDrawOverlays(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)

    private fun openOverlaySettings() {
        val intent =
            Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName"),
            )
        startActivity(intent)
    }

    private fun requestNotifPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
}
