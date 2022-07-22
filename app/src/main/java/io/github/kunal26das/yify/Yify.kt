package io.github.kunal26das.yify

import android.app.Application
import android.content.Context
import androidx.work.Configuration
import coil.Coil
import com.facebook.stetho.Stetho
import com.google.android.material.color.DynamicColors
import dagger.hilt.android.HiltAndroidApp
import io.github.kunal26das.yify.coil.YifyImageLoader
import io.github.kunal26das.yify.work.WorkConfiguration
import org.koin.android.ext.koin.androidContext
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject
import org.koin.core.context.startKoin
import javax.inject.Inject

@HiltAndroidApp
class Yify : Application(), Configuration.Provider {

    @Inject
    lateinit var workConfiguration: WorkConfiguration

    override fun onCreate() {
        super.onCreate()
        startKoin { androidContext(applicationContext) }
        DynamicColors.applyToActivitiesIfAvailable(this)
        Coil.setImageLoader(YifyImageLoader.INSTANCE)
        Stetho.initializeWithDefaults(this)
    }

    override fun getWorkManagerConfiguration(): Configuration {
        return workConfiguration.INSTANCE
    }

    companion object : KoinComponent {
        val INSTANCE by inject<Context>()
    }

}