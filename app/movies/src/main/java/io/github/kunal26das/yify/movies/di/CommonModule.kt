package io.github.kunal26das.yify.movies.di

import androidx.datastore.dataStoreFile
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.crashlytics.ktx.crashlytics
import com.google.firebase.ktx.Firebase
import io.github.kunal26das.yify.movies.domain.logger.ExceptionLogger
import io.github.kunal26das.yify.movies.domain.logger.Logger
import io.github.kunal26das.yify.movies.domain.preference.DataStoreFileProducer
import io.github.kunal26das.yify.movies.logger.AndroidLogger
import io.github.kunal26das.yify.movies.logger.CrashlyticsLogger
import io.github.kunal26das.yify.movies.presentation.MoviesViewModel
import io.github.kunal26das.yify.movies.usecase.MoviesPagerUseCase
import org.koin.android.ext.koin.androidContext
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.module

val commonModule = module {
    viewModel { MoviesViewModel(get()) }
    factory<Logger> { AndroidLogger() }
    factory { MoviesPagerUseCase(get()) }
    factory<ExceptionLogger> { CrashlyticsLogger(get()) }
    factory<FirebaseCrashlytics> { Firebase.crashlytics }
    factory {
        DataStoreFileProducer { fileName ->
            androidContext().dataStoreFile(fileName)
        }
    }
}