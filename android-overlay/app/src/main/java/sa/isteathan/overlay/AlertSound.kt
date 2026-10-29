package sa.isteathan.overlay

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import java.util.Locale

class AlertSound(context: Context) {
    private val appContext = context.applicationContext
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private val main = Handler(Looper.getMainLooper())

    init {
        tts = TextToSpeech(appContext) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (!ttsReady) return@TextToSpeech
            val engine = tts ?: return@TextToSpeech
            val saudi = engine.setLanguage(Locale("ar", "SA"))
            if (saudi == TextToSpeech.LANG_MISSING_DATA || saudi == TextToSpeech.LANG_NOT_SUPPORTED) {
                engine.setLanguage(Locale("ar"))
            }
            engine.setSpeechRate(0.92f)
            engine.setPitch(1.0f)
        }
    }

    fun playChime() {
        try {
            val tg = ToneGenerator(AudioManager.STREAM_ALARM, 90)
            tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 450)
            main.postDelayed({
                tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 450)
                main.postDelayed({ tg.release() }, 500)
            }, 550)
        } catch (_: Exception) {
            // ignore
        }
    }

    fun announceNew(studentName: String) {
        playChime()
        val name = studentName.replace("ـ", "").trim()
        val text =
            if (name.isEmpty()) "طلب استئذان جديد"
            else "طلب استئذان جديد للطالب $name"
        speak(text)
    }

    fun announceDecision(studentName: String, approved: Boolean) {
        playChime()
        val name = studentName.replace("ـ", "").trim().ifEmpty { "الطالب" }
        val text =
            if (approved) "تمت الموافقة على استئذان الطالب $name"
            else "تم رفض استئذان الطالب $name"
        speak(text)
    }

    private fun speak(text: String) {
        main.postDelayed({
            val engine = tts ?: return@postDelayed
            if (!ttsReady) return@postDelayed
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "isteathan-alert")
        }, 700)
    }

    fun release() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        ttsReady = false
    }
}
