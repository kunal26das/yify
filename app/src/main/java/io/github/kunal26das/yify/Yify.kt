package io.github.kunal26das.yify

import android.app.Application
import com.facebook.stetho.Stetho

class Yify : Application() {

    override fun onCreate() {
        super.onCreate()
        Stetho.initializeWithDefaults(this)
    }

}