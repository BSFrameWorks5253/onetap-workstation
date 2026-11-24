package com.onetap.studiotracker

import android.app.Application
import android.content.Context
import android.content.Intent
import android.os.Process
import android.util.Log

class OneTapApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        instance = this

        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e("OneTapStudio", "FATAL CRASH INTERCEPTED on thread [${thread.name}]", throwable)
            val errorMsg = throwable.localizedMessage ?: throwable.message ?: throwable.javaClass.simpleName
            val stackTrace = Log.getStackTraceString(throwable)

            lastCrashThrowable = throwable
            lastCrashMessage = errorMsg
            lastCrashStackTrace = stackTrace

            try {
                val prefs = getSharedPreferences("one_tap_diagnostics", Context.MODE_PRIVATE)
                prefs.edit()
                    .putString("last_crash_msg", errorMsg)
                    .putString("last_crash_trace", stackTrace)
                    .putLong("last_crash_timestamp", System.currentTimeMillis())
                    .apply()
            } catch (t: Throwable) {
                Log.e("OneTapStudio", "Failed saving crash prefs", t)
            }

            try {
                val crashIntent = Intent(this, CrashActivity::class.java).apply {
                    putExtra("error_message", errorMsg)
                    putExtra("stack_trace", stackTrace)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                }
                startActivity(crashIntent)
                Process.killProcess(Process.myPid())
                System.exit(10)
            } catch (t: Throwable) {
                Log.e("OneTapStudio", "Failed starting CrashActivity", t)
                defaultHandler?.uncaughtException(thread, throwable)
            }
        }
    }

    companion object {
        lateinit var instance: OneTapApplication
            private set

        var lastCrashThrowable: Throwable? = null
        var lastCrashMessage: String? = null
        var lastCrashStackTrace: String? = null
    }
}
