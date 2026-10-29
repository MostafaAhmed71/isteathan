package sa.isteathan.overlay

import android.content.Context
import android.content.SharedPreferences

class Prefs(context: Context) {
    private val sp: SharedPreferences =
        context.getSharedPreferences("isteathan_overlay", Context.MODE_PRIVATE)

    var accessToken: String?
        get() = sp.getString(KEY_TOKEN, null)
        set(value) = sp.edit().putString(KEY_TOKEN, value).apply()

    var userId: String?
        get() = sp.getString(KEY_USER_ID, null)
        set(value) = sp.edit().putString(KEY_USER_ID, value).apply()

    var staffName: String?
        get() = sp.getString(KEY_STAFF_NAME, null)
        set(value) = sp.edit().putString(KEY_STAFF_NAME, value).apply()

    var classId: String?
        get() = sp.getString(KEY_CLASS_ID, null)
        set(value) = sp.edit().putString(KEY_CLASS_ID, value).apply()

    var classLabel: String?
        get() = sp.getString(KEY_CLASS_LABEL, null)
        set(value) = sp.edit().putString(KEY_CLASS_LABEL, value).apply()

    var serviceEnabled: Boolean
        get() = sp.getBoolean(KEY_SERVICE, false)
        set(value) = sp.edit().putBoolean(KEY_SERVICE, value).apply()

    fun knownIds(): MutableSet<String> =
        sp.getStringSet(KEY_KNOWN, emptySet())?.toMutableSet() ?: mutableSetOf()

    fun saveKnownIds(ids: Set<String>) {
        sp.edit().putStringSet(KEY_KNOWN, ids).apply()
    }

    fun knownStatuses(): MutableMap<String, String> {
        val raw = sp.getString(KEY_STATUSES, "") ?: ""
        if (raw.isBlank()) return mutableMapOf()
        return raw
            .split("|")
            .mapNotNull {
                val p = it.split("=", limit = 2)
                if (p.size == 2) p[0] to p[1] else null
            }.toMap()
            .toMutableMap()
    }

    fun saveKnownStatuses(map: Map<String, String>) {
        val raw = map.entries.joinToString("|") { "${it.key}=${it.value}" }
        sp.edit().putString(KEY_STATUSES, raw).apply()
    }

    fun clearSession() {
        sp.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_USER_ID)
            .remove(KEY_STAFF_NAME)
            .remove(KEY_CLASS_ID)
            .remove(KEY_CLASS_LABEL)
            .putBoolean(KEY_SERVICE, false)
            .apply()
    }

    fun isLoggedIn(): Boolean =
        !accessToken.isNullOrBlank() && !classId.isNullOrBlank()

    companion object {
        private const val KEY_TOKEN = "access_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_STAFF_NAME = "staff_name"
        private const val KEY_CLASS_ID = "class_id"
        private const val KEY_CLASS_LABEL = "class_label"
        private const val KEY_SERVICE = "service_enabled"
        private const val KEY_KNOWN = "known_ids"
        private const val KEY_STATUSES = "known_statuses"
    }
}
