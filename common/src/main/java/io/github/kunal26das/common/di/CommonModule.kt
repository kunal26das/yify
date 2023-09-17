package io.github.kunal26das.common.di

import android.content.Context
import android.net.ConnectivityManager
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.crashlytics.ktx.crashlytics
import com.google.firebase.ktx.Firebase
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.common.connectivity.ConnectivityObserverImpl
import io.github.kunal26das.common.domain.connectivity.ConnectivityObserver
import io.github.kunal26das.common.domain.download.FileDownloader
import io.github.kunal26das.common.domain.logger.CrashLogger
import io.github.kunal26das.common.domain.logger.Logger
import io.github.kunal26das.common.download.AndroidFileDownloaderImpl
import io.github.kunal26das.common.logger.AndroidLogger
import io.github.kunal26das.common.logger.CrashlyticsLogger

@Module
@InstallIn(SingletonComponent::class)
internal abstract class CommonModule {

    @Binds
    abstract fun bindConnectivityManager(
        connectivityObserverImpl: ConnectivityObserverImpl
    ): ConnectivityObserver

    @Binds
    abstract fun bindFileDownloader(
        androidFileDownloaderImpl: AndroidFileDownloaderImpl
    ): FileDownloader

    @Binds
    abstract fun bindLogger(
        androidLogger: AndroidLogger
    ): Logger

    @Binds
    abstract fun bindCrashLogger(
        crashlyticsLogger: CrashlyticsLogger
    ): CrashLogger

    companion object {

        @Provides
        fun providesConnectivityManager(
            @ApplicationContext context: Context
        ): ConnectivityManager {
            return context.getSystemService(ConnectivityManager::class.java)
        }

        @Provides
        fun providesFirebaseCrashlytics(): FirebaseCrashlytics {
            return Firebase.crashlytics
        }
    }
}