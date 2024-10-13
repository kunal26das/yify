package io.github.kunal26das.yify

import android.app.Application
import com.google.android.material.color.DynamicColors
import io.github.kunal26das.yify.di.androidModule
import io.github.kunal26das.yify.movies.data.di.moviesDataModule
import io.github.kunal26das.yify.movies.di.moviesModule
import io.github.kunal26das.yify.movies.di.networkModule
import org.koin.android.ext.koin.androidContext
import org.koin.androix.startup.KoinStartup.onKoinStartup
import org.koin.core.annotation.KoinExperimentalAPI

@OptIn(KoinExperimentalAPI::class)
class Yify : Application() {

    init {
        onKoinStartup {
            androidContext(this@Yify)
            modules(
                moviesModule,
                androidModule,
                moviesDataModule,
                networkModule(
                    debug = BuildConfig.DEBUG,
                    dnsUrl = BuildConfig.DNS_URL,
                    baseUrl = BuildConfig.BASE_URL,
                ),
            )
        }
    }

    override fun onCreate() {
        super.onCreate()
        DynamicColors.applyToActivitiesIfAvailable(this)
    }
}