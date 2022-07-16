package io.github.kunal26das.yify

import android.app.Application
import android.content.Context
import coil.Coil
import com.facebook.stetho.Stetho
import com.google.android.material.color.DynamicColors
import dagger.hilt.android.HiltAndroidApp
import io.github.kunal26das.yify.coil.YifyImageLoader
import org.koin.android.ext.koin.androidContext
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject
import org.koin.core.context.startKoin

@HiltAndroidApp
class Yify : Application() {

    override fun onCreate() {
        super.onCreate()
        startKoin { androidContext(applicationContext) }
        DynamicColors.applyToActivitiesIfAvailable(this)
        Coil.setImageLoader(YifyImageLoader.INSTANCE)
        Stetho.initializeWithDefaults(this)
    }

    companion object : KoinComponent {
        val INSTANCE by inject<Context>()
    }

}