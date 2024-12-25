package io.github.kunal26das.yify

import android.app.Application
import com.google.android.material.color.DynamicColors
import io.github.kunal26das.yify.di.networkModule
import io.github.kunal26das.yify.movies.data.di.moviesDataModule
import io.github.kunal26das.yify.movies.di.commonModule
import org.koin.android.ext.koin.androidContext
import org.koin.androix.startup.KoinStartup
import org.koin.core.annotation.KoinExperimentalAPI
import org.koin.dsl.KoinConfiguration

@OptIn(KoinExperimentalAPI::class)
class Yify : Application(), KoinStartup {

    override fun onCreate() {
        super.onCreate()
        DynamicColors.applyToActivitiesIfAvailable(this)
    }

    override fun onKoinStartup(): KoinConfiguration {
        return KoinConfiguration {
            androidContext(this@Yify)
            modules(
                commonModule,
                networkModule,
                moviesDataModule,
            )
        }
    }
}