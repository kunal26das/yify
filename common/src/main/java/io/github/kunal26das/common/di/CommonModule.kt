package io.github.kunal26das.common.di

import android.content.Context
import android.net.ConnectivityManager
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.common.connectivity.ConnectivityObserver
import io.github.kunal26das.common.connectivity.ConnectivityObserverImpl
import io.github.kunal26das.common.download.AndroidFileDownloaderImpl
import io.github.kunal26das.common.download.FileDownloader

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

    companion object {

        @Provides
        fun providesConnectivityManager(
            @ApplicationContext context: Context
        ): ConnectivityManager {
            return context.getSystemService(ConnectivityManager::class.java)
        }
    }
}