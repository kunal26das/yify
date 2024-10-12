package io.github.kunal26das.yify.movies.di

import android.content.Context
import android.net.ConnectivityManager
import androidx.datastore.dataStoreFile
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.crashlytics.ktx.crashlytics
import com.google.firebase.ktx.Firebase
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.yify.movies.domain.logger.ExceptionLogger
import io.github.kunal26das.yify.movies.domain.logger.Logger
import io.github.kunal26das.yify.movies.domain.preference.DataStoreFileProducer
import io.github.kunal26das.yify.movies.logger.AndroidLogger
import io.github.kunal26das.yify.movies.logger.CrashlyticsLogger

@Module
@InstallIn(SingletonComponent::class)
internal abstract class CommonModule {

    @Binds
    abstract fun bindLogger(
        androidLogger: AndroidLogger
    ): Logger

    @Binds
    abstract fun bindCrashLogger(
        crashlyticsLogger: CrashlyticsLogger
    ): ExceptionLogger

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

        @Provides
        fun providesDataStoreProducer(
            @ApplicationContext context: Context,
        ): DataStoreFileProducer {
            return DataStoreFileProducer { fileName ->
                context.dataStoreFile(fileName)
            }
        }
    }
}