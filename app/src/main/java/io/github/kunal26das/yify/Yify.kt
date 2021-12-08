package io.github.kunal26das.yify

import android.app.Application
import android.os.StrictMode
import android.os.StrictMode.VmPolicy
import com.facebook.stetho.Stetho
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class Yify : Application() {

    private fun initStrictMode() {
        if (BuildConfig.DEBUG) {
            StrictMode.setVmPolicy(
                VmPolicy.Builder().penaltyLog().detectAll().build()
            )
            StrictMode.setThreadPolicy(
                StrictMode.ThreadPolicy.Builder().penaltyLog().detectAll().build()
            )
        }
    }

    override fun onCreate() {
        initStrictMode()
        super.onCreate()
        Stetho.initializeWithDefaults(this)
    }

}