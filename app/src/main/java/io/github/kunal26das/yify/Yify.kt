package io.github.kunal26das.yify

import android.app.Application
import androidx.work.Configuration
import com.google.android.material.color.DynamicColors
import dagger.hilt.android.HiltAndroidApp
import io.github.kunal26das.yify.work.WorkConfiguration
import javax.inject.Inject

@HiltAndroidApp
class Yify : Application(), Configuration.Provider {

    @Inject
    lateinit var workConfiguration: WorkConfiguration

    override fun onCreate() {
        super.onCreate()
        DynamicColors.applyToActivitiesIfAvailable(this)
    }

    override fun getWorkManagerConfiguration(): Configuration {
        return workConfiguration.INSTANCE
    }

}