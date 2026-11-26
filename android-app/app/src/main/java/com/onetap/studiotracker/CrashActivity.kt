package com.onetap.studiotracker

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onetap.studiotracker.ui.theme.LightBackground
import com.onetap.studiotracker.ui.theme.OneTapStudioTheme
import com.onetap.studiotracker.ui.theme.RoseError
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary

class CrashActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val msg = intent.getStringExtra("error_message") ?: "Unexpected error"
        val trace = intent.getStringExtra("stack_trace") ?: ""

        setContent {
            OneTapStudioTheme {
                Column(
                    modifier = Modifier.fillMaxSize().background(LightBackground).padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("One Tap Diagnostics", color = RoseError, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Text(msg, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                        Button(onClick = {
                            (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
                                .setPrimaryClip(ClipData.newPlainText("Crash Log", "$msg\n\n$trace"))
                            Toast.makeText(this@CrashActivity, "Crash log copied!", Toast.LENGTH_SHORT).show()
                        }, modifier = Modifier.weight(1f)) { Text("Copy Log") }
                        OutlinedButton(onClick = {
                            startActivity(Intent(this@CrashActivity, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
                            finish()
                        }, modifier = Modifier.weight(1f)) { Text("Restart") }
                    }
                    Text(
                        text = trace,
                        color = TextSecondary,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier.weight(1f).verticalScroll(rememberScrollState())
                    )
                }
            }
        }
    }
}
