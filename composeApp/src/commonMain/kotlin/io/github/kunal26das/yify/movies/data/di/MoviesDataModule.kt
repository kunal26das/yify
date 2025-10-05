package io.github.kunal26das.yify.movies.data.di

import io.github.kunal26das.yify.movies.data.mapper.GenreMapper
import io.github.kunal26das.yify.movies.data.mapper.LanguageMapper
import io.github.kunal26das.yify.movies.data.mapper.MovieMapper
import io.github.kunal26das.yify.movies.data.repo.MovieRepositoryImpl
import io.github.kunal26das.yify.movies.data.service.MovieService
import io.github.kunal26das.yify.movies.data.service.MovieServiceImpl
import io.github.kunal26das.yify.movies.domain.repo.MovieRepository
import org.koin.dsl.module

val moviesDataModule = module {
    factory { MovieMapper(get(), get()) }
    factory { GenreMapper(get()) }
    factory { LanguageMapper(get()) }
    factory<MovieService> { MovieServiceImpl(get(), get()) }
    factory<MovieRepository> { MovieRepositoryImpl(get(), get(), get(), get()) }
}