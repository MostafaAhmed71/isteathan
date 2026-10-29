package sa.isteathan.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.temporal.ChronoUnit

class OverlayService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var prefs: Prefs
    private lateinit var api: SupabaseApi
    private var overlay: FloatingOverlay? = null
    private var sound: AlertSound? = null
    private var pollJob: Job? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var primed = false

    override fun onCreate() {
        super.onCreate()
        prefs = Prefs(this)
        api = SupabaseApi()
        overlay = FloatingOverlay(applicationContext)
        sound = AlertSound(applicationContext)
        createChannel()
        acquireWakeLock()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                prefs.serviceEnabled = false
                stopSelfSafely()
                return START_NOT_STICKY
            }
        }
        if (!prefs.isLoggedIn()) {
            stopSelfSafely()
            return START_NOT_STICKY
        }
        prefs.serviceEnabled = true
        startAsForeground()
        startPolling()
        return START_STICKY
    }

    override fun onDestroy() {
        pollJob?.cancel()
        scope.cancel()
        overlay?.destroy()
        sound?.release()
        releaseWakeLock()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startAsForeground() {
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stop = PendingIntent.getService(
            this,
            1,
            Intent(this, OverlayService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification: Notification =
            NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(getString(R.string.notif_title))
                .setContentText(
                    "${getString(R.string.notif_text)} · ${prefs.classLabel.orEmpty()}",
                )
                .setSmallIcon(R.drawable.ic_notification)
                .setContentIntent(open)
                .addAction(0, getString(R.string.stop_service), stop)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIF_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            startForeground(NOTIF_ID, notification)
        }
    }

    private fun startPolling() {
        if (pollJob?.isActive == true) return
        pollJob = scope.launch {
            while (isActive) {
                runCatching { tick() }
                delay(POLL_MS)
            }
        }
    }

    private fun tick() {
        val token = prefs.accessToken ?: return
        val classId = prefs.classId ?: return
        val pending = api.fetchPending(token, classId)
        val since = Instant.now().minus(10, ChronoUnit.MINUTES).toString()
        val recent = api.fetchRecentDecided(token, classId, since)

        val known = prefs.knownIds()
        val statuses = prefs.knownStatuses()

        if (primed) {
            val fresh = pending.firstOrNull { it.id !in known }
            if (fresh != null) {
                known.add(fresh.id)
                statuses[fresh.id] = fresh.status
                prefs.saveKnownIds(known)
                prefs.saveKnownStatuses(statuses)
                sound?.announceNew(fresh.studentName)
                overlay?.show(
                    fresh,
                    bandText = getString(R.string.new_request),
                    autoHideMs = 20_000L,
                )
                return
            }

            for (row in recent) {
                val prev = statuses[row.id]
                if (prev == "PENDING" && (row.status == "APPROVED" || row.status == "REJECTED")) {
                    statuses[row.id] = row.status
                    prefs.saveKnownStatuses(statuses)
                    val approved = row.status == "APPROVED"
                    sound?.announceDecision(row.studentName, approved)
                    overlay?.updateStatus(
                        row,
                        bandText = if (approved) {
                            getString(R.string.approved)
                        } else {
                            getString(R.string.rejected)
                        },
                    )
                    return
                }
            }
        }

        for (row in pending) {
            known.add(row.id)
            statuses[row.id] = row.status
        }
        for (row in recent) {
            known.add(row.id)
            statuses[row.id] = row.status
        }
        // Keep map bounded
        if (known.size > 80) {
            val trim = known.toList().takeLast(40).toMutableSet()
            prefs.saveKnownIds(trim)
            prefs.saveKnownStatuses(statuses.filterKeys { it in trim })
        } else {
            prefs.saveKnownIds(known)
            prefs.saveKnownStatuses(statuses)
        }
        primed = true
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = getSystemService(NotificationManager::class.java)
        val channel =
            NotificationChannel(
                CHANNEL_ID,
                getString(R.string.channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = getString(R.string.channel_desc)
                setShowBadge(false)
            }
        mgr.createNotificationChannel(channel)
    }

    private fun acquireWakeLock() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock =
            pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "isteathan:overlay").apply {
                setReferenceCounted(false)
                acquire(6 * 60 * 60 * 1000L)
            }
    }

    private fun releaseWakeLock() {
        runCatching {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        }
        wakeLock = null
    }

    private fun stopSelfSafely() {
        pollJob?.cancel()
        overlay?.hide()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    companion object {
        const val CHANNEL_ID = "isteathan_overlay"
        const val NOTIF_ID = 4201
        const val ACTION_STOP = "sa.isteathan.overlay.STOP"
        const val POLL_MS = 8_000L

        fun start(context: Context) {
            val intent = Intent(context, OverlayService::class.java)
            ContextCompatStart.start(context, intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, OverlayService::class.java).setAction(ACTION_STOP)
            ContextCompatStart.start(context, intent)
        }
    }
}

private object ContextCompatStart {
    fun start(context: Context, intent: Intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }
}
