package io.github.kunal26das.yify

import android.app.Application
import com.google.android.material.color.DynamicColors
import io.github.kunal26das.yify.di.networkModule
import io.github.kunal26das.yify.movies.data.di.moviesDataModule
import io.github.kunal26das.yify.movies.di.commonModule
import org.koin.android.ext.koin.androidContext
import org.koin.androix.startup.KoinStartup.onKoinStartup
import org.koin.core.annotation.KoinExperimentalAPI

@OptIn(KoinExperimentalAPI::class)
class Yify : Application() {

    init {
        onKoinStartup {
            androidContext(this@Yify)
            modules(
                commonModule,
                networkModule,
                moviesDataModule,
            )
        }
    }

    override fun onCreate() {
        super.onCreate()
        DynamicColors.applyToActivitiesIfAvailable(this)
    }
}