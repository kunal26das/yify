package io.github.kunal26das.yify.movies.di

import io.github.kunal26das.yify.movies.domain.logger.ExceptionLogger
import io.github.kunal26das.yify.movies.logger.CrashlyticsLogger
import io.github.kunal26das.yify.movies.presentation.MoviesViewModel
import io.github.kunal26das.yify.movies.usecase.MoviesPagerUseCase
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.module

val commonModule = module {
    viewModel { MoviesViewModel(get()) }
    factory { MoviesPagerUseCase(get()) }
    factory<ExceptionLogger> { CrashlyticsLogger() }
}