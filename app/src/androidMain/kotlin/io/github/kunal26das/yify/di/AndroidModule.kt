package io.github.kunal26das.yify.di

import androidx.datastore.dataStoreFile
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.crashlytics.ktx.crashlytics
import com.google.firebase.ktx.Firebase
import io.github.kunal26das.yify.logger.AndroidLogger
import io.github.kunal26das.yify.logger.CrashlyticsLogger
import io.github.kunal26das.yify.movies.domain.logger.ExceptionLogger
import io.github.kunal26das.yify.movies.domain.logger.Logger
import io.github.kunal26das.yify.movies.domain.preference.DataStoreFileProducer
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

val androidModule = module {
    factory<Logger> { AndroidLogger() }
    factory<ExceptionLogger> { CrashlyticsLogger(get()) }
    factory<FirebaseCrashlytics> { Firebase.crashlytics }
    factory {
        DataStoreFileProducer { fileName ->
            androidContext().dataStoreFile(fileName)
        }
    }
}