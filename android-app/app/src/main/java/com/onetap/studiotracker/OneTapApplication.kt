package com.onetap.studiotracker

import android.app.Application
import android.content.Intent
import android.os.Process
import android.util.Log
import com.onetap.studiotracker.data.repository.SafarRepository
import com.onetap.studiotracker.worker.SafarBackgroundWorker
import kotlin.system.exitProcess

class OneTapApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e("OneTapApp", "Uncaught exception on ${thread.name}", throwable)
            try {
                val intent = Intent(this, CrashActivity::class.java).apply {
                    putExtra("error_message", throwable.localizedMessage ?: throwable.javaClass.simpleName)
                    putExtra("stack_trace", Log.getStackTraceString(throwable))
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                }
                startActivity(intent)
                Process.killProcess(Process.myPid())
                exitProcess(10)
            } catch (_: Throwable) {
                defaultHandler?.uncaughtException(thread, throwable)
            }
        }

        try {
            SafarRepository.init(this)
        } catch (t: Throwable) {
            Log.e("OneTapApp", "SafarRepository init error", t)
        }
        try {
            SafarBackgroundWorker.schedule(this)
        } catch (t: Throwable) {
            Log.e("OneTapApp", "WorkManager schedule error", t)
        }
    }
}
