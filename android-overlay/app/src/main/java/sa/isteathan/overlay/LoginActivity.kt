package sa.isteathan.overlay

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LoginActivity : AppCompatActivity() {
    private lateinit var prefs: Prefs
    private val api = SupabaseApi()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        if (prefs.isLoggedIn()) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }
        setContentView(R.layout.activity_login)
        val email = findViewById<TextInputEditText>(R.id.inputEmail)
        val password = findViewById<TextInputEditText>(R.id.inputPassword)
        val error = findViewById<android.widget.TextView>(R.id.textError)
        val btn = findViewById<MaterialButton>(R.id.btnLogin)

        btn.setOnClickListener {
            val e = email.text?.toString().orEmpty().trim()
            val p = password.text?.toString().orEmpty()
            if (e.isBlank() || p.isBlank()) {
                showError(error, "يرجى إدخال اسم الدخول وكلمة المرور.")
                return@setOnClickListener
            }
            btn.isEnabled = false
            error.visibility = View.GONE
            lifecycleScope.launch {
                try {
                    val session =
                        withContext(Dispatchers.IO) {
                            api.login(e, p)
                        }
                    prefs.accessToken = session.accessToken
                    prefs.userId = session.userId
                    prefs.staffName = session.staffName
                    prefs.classId = session.classId
                    prefs.classLabel = session.classLabel
                    startActivity(Intent(this@LoginActivity, MainActivity::class.java))
                    finish()
                } catch (ex: Exception) {
                    showError(error, ex.message ?: "فشل تسجيل الدخول")
                    Toast.makeText(this@LoginActivity, ex.message, Toast.LENGTH_LONG).show()
                } finally {
                    btn.isEnabled = true
                }
            }
        }
    }

    private fun showError(view: android.widget.TextView, message: String) {
        view.text = message
        view.visibility = View.VISIBLE
    }
}
