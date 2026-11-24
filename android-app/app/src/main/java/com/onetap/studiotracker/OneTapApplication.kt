package com.onetap.studiotracker

import android.app.Application
import android.content.Context
import android.util.Log

class OneTapApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        instance = this

        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e("OneTapStudio", "FATAL CRASH PREVENTED on thread [${thread.name}]", throwable)
            lastCrashThrowable = throwable
            lastCrashMessage = throwable.localizedMessage ?: throwable.message ?: throwable.javaClass.simpleName
            lastCrashStackTrace = Log.getStackTraceString(throwable)

            // Save crash info to shared preferences for diagnostic display
            try {
                val prefs = getSharedPreferences("one_tap_diagnostics", Context.MODE_PRIVATE)
                prefs.edit()
                    .putString("last_crash_msg", lastCrashMessage)
                    .putString("last_crash_trace", lastCrashStackTrace)
                    .putLong("last_crash_timestamp", System.currentTimeMillis())
                    .apply()
            } catch (t: Throwable) {
                Log.e("OneTapStudio", "Failed saving crash prefs", t)
            }

            // Hand over to default handler if critical or let app process recover
            defaultHandler?.uncaughtException(thread, throwable)
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
