package io.github.kunal26das.yify

import android.app.Application
import org.koin.android.ext.koin.androidContext

class Yify : Application() {
    override fun onCreate() {
        super.onCreate()
        initKoin {
            androidContext(applicationContext)
            modules(networkModule)
        }
    }
}