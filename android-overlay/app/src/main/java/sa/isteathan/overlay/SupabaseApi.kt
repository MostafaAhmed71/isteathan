package sa.isteathan.overlay

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

data class SessionInfo(
    val accessToken: String,
    val userId: String,
    val staffName: String,
    val classId: String,
    val classLabel: String,
)

data class PermissionRow(
    val id: String,
    val status: String,
    val studentName: String,
    val classLabel: String,
    val createdAt: String,
    val decidedAt: String?,
)

class SupabaseApi(
    private val baseUrl: String = BuildConfig.SUPABASE_URL.trimEnd('/'),
    private val anonKey: String = BuildConfig.SUPABASE_ANON_KEY,
) {
    private val http = okhttp3.OkHttpClient.Builder()
        .connectTimeout(20, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(20, java.util.concurrent.TimeUnit.SECONDS)
        .build()

    private fun ensureConfigured() {
        if (baseUrl.isBlank() || anonKey.isBlank() ||
            baseUrl.contains("YOUR_PROJECT") || anonKey.contains("YOUR_ANON")
        ) {
            throw IllegalStateException(
                "أضف supabase.url و supabase.anonKey في android-overlay/local.properties",
            )
        }
    }

    fun login(email: String, password: String): SessionInfo {
        ensureConfigured()
        val body = org.json.JSONObject()
            .put("email", email.trim())
            .put("password", password)
            .toString()
        val req = okhttp3.Request.Builder()
            .url("$baseUrl/auth/v1/token?grant_type=password")
            .addHeader("apikey", anonKey)
            .addHeader("Content-Type", "application/json")
            .post(body.toRequestBody(JSON))
            .build()
        http.newCall(req).execute().use { res ->
            val text = res.body?.string().orEmpty()
            if (!res.isSuccessful) {
                throw IllegalStateException(parseAuthError(text))
            }
            val json = org.json.JSONObject(text)
            val token = json.getString("access_token")
            val user = json.getJSONObject("user")
            val userId = user.getString("id")
            val profile = fetchProfile(token, userId)
            if (profile.optString("role") != "CLASS_STAFF") {
                throw IllegalStateException("هذا الحساب ليس مشرف فصل.")
            }
            val schoolClass = fetchClass(token, userId)
                ?: throw IllegalStateException("لا يوجد فصل مرتبط بهذا الحساب.")
            val grade = schoolClass.optInt("grade", 0)
            val section = schoolClass.optString("section")
            return SessionInfo(
                accessToken = token,
                userId = userId,
                staffName = profile.optString("full_name", "مشرف الفصل"),
                classId = schoolClass.getString("id"),
                classLabel = classLabel(grade, section),
            )
        }
    }

    fun fetchPending(token: String, classId: String): List<PermissionRow> {
        ensureConfigured()
        val url =
            "$baseUrl/rest/v1/permission_requests" +
                "?class_id=eq.$classId" +
                "&status=eq.PENDING" +
                "&select=id,status,created_at,decided_at,students(full_name),classes(grade,section)" +
                "&order=created_at.desc" +
                "&limit=20"
        return fetchRows(token, url)
    }

    fun fetchRecentDecided(token: String, classId: String, sinceIso: String): List<PermissionRow> {
        ensureConfigured()
        val url =
            "$baseUrl/rest/v1/permission_requests" +
                "?class_id=eq.$classId" +
                "&status=in.(APPROVED,REJECTED)" +
                "&decided_at=gte.$sinceIso" +
                "&select=id,status,created_at,decided_at,students(full_name),classes(grade,section)" +
                "&order=decided_at.desc" +
                "&limit=20"
        return fetchRows(token, url)
    }

    private fun fetchRows(token: String, url: String): List<PermissionRow> {
        val req = okhttp3.Request.Builder()
            .url(url)
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Accept", "application/json")
            .get()
            .build()
        http.newCall(req).execute().use { res ->
            val text = res.body?.string().orEmpty()
            if (!res.isSuccessful) {
                throw IllegalStateException("تعذر تحميل الطلبات (${res.code})")
            }
            val arr = org.json.JSONArray(text)
            val out = ArrayList<PermissionRow>(arr.length())
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val students = o.optJSONObject("students")
                val classes = o.optJSONObject("classes")
                val grade = classes?.optInt("grade", 0) ?: 0
                val section = classes?.optString("section").orEmpty()
                out.add(
                    PermissionRow(
                        id = o.getString("id"),
                        status = o.getString("status"),
                        studentName = students?.optString("full_name") ?: "طالب",
                        classLabel = if (grade > 0) classLabel(grade, section) else "—",
                        createdAt = o.optString("created_at"),
                        decidedAt = o.optString("decided_at").ifBlank { null },
                    ),
                )
            }
            return out
        }
    }

    private fun fetchProfile(token: String, userId: String): org.json.JSONObject {
        val req = okhttp3.Request.Builder()
            .url("$baseUrl/rest/v1/profiles?id=eq.$userId&select=id,full_name,role")
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Accept", "application/json")
            .get()
            .build()
        http.newCall(req).execute().use { res ->
            val text = res.body?.string().orEmpty()
            if (!res.isSuccessful) throw IllegalStateException("تعذر قراءة الملف الشخصي.")
            val arr = org.json.JSONArray(text)
            if (arr.length() == 0) throw IllegalStateException("الملف الشخصي غير موجود.")
            return arr.getJSONObject(0)
        }
    }

    private fun fetchClass(token: String, staffId: String): org.json.JSONObject? {
        val req = okhttp3.Request.Builder()
            .url(
                "$baseUrl/rest/v1/classes?staff_profile_id=eq.$staffId&is_active=eq.true&select=id,grade,section,name&limit=1",
            )
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Accept", "application/json")
            .get()
            .build()
        http.newCall(req).execute().use { res ->
            val text = res.body?.string().orEmpty()
            if (!res.isSuccessful) return null
            val arr = org.json.JSONArray(text)
            return if (arr.length() > 0) arr.getJSONObject(0) else null
        }
    }

    private fun parseAuthError(text: String): String {
        return try {
            val msg = org.json.JSONObject(text).optString("error_description")
                .ifBlank { org.json.JSONObject(text).optString("msg") }
                .ifBlank { org.json.JSONObject(text).optString("error") }
            if (msg.isBlank()) "بيانات الدخول غير صحيحة." else msg
        } catch (_: Exception) {
            "بيانات الدخول غير صحيحة."
        }
    }

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()

        private val GRADE_LABELS = mapOf(
            1 to "الأول الابتدائي",
            2 to "الثاني الابتدائي",
            3 to "الثالث الابتدائي",
            4 to "الرابع الابتدائي",
            5 to "الخامس الابتدائي",
            6 to "السادس الابتدائي",
        )

        fun classLabel(grade: Int, section: String): String {
            val g = GRADE_LABELS[grade] ?: grade.toString()
            return "الصف $g — $section"
        }
    }
}
