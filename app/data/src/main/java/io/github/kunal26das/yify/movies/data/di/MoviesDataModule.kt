package io.github.kunal26das.yify.movies.data.di

import io.github.kunal26das.yify.movies.data.mapper.GenreMapper
import io.github.kunal26das.yify.movies.data.mapper.LanguageMapper
import io.github.kunal26das.yify.movies.data.mapper.MovieMapper
import io.github.kunal26das.yify.movies.data.preference.MoviePreferenceDto
import io.github.kunal26das.yify.movies.data.preference.MoviePreferencesImpl
import io.github.kunal26das.yify.movies.data.repo.MovieRepositoryImpl
import io.github.kunal26das.yify.movies.data.service.MovieService
import io.github.kunal26das.yify.movies.data.service.MovieServiceImpl
import io.github.kunal26das.yify.movies.domain.preference.DataStoreCreator
import io.github.kunal26das.yify.movies.domain.preference.MoviePreferences
import io.github.kunal26das.yify.movies.domain.repo.MovieRepository
import org.koin.dsl.module

private const val MOVIE_PREFERENCE_JSON = "movie_preference.json"

val moviesDataModule = module {
    factory { MovieMapper(get(), get()) }
    factory { GenreMapper(get(), get()) }
    factory { LanguageMapper(get(), get()) }
    factory<MovieService> { MovieServiceImpl(get(), get()) }
    factory<MoviePreferences> { MoviePreferencesImpl(get()) }
    factory<MovieRepository> { MovieRepositoryImpl(get(), get(), get(), get()) }
    single {
        DataStoreCreator.create(
            json = get(),
            exceptionLogger = get(),
            dataStoreFileProducer = get(),
            fileName = MOVIE_PREFERENCE_JSON,
            serializationStrategy = MoviePreferenceDto.serializer(),
            deserializationStrategy = MoviePreferenceDto.serializer(),
        )
    }
}