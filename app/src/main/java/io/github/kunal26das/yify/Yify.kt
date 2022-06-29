package io.github.kunal26das.yify

import android.app.Application
import coil.Coil
import com.facebook.stetho.Stetho
import com.google.android.material.color.DynamicColors
import dagger.hilt.android.HiltAndroidApp
import io.github.kunal26das.yify.coil.YifyImageLoader

@HiltAndroidApp
class Yify : Application() {

    override fun onCreate() {
        super.onCreate()
        Stetho.initializeWithDefaults(this)
        DynamicColors.applyToActivitiesIfAvailable(this)
        Coil.setImageLoader(YifyImageLoader(this).INSTANCE)
    }

}