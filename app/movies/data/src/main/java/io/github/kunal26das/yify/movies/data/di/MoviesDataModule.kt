package io.github.kunal26das.yify.movies.data.di

import androidx.datastore.core.DataStore
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.yify.movies.data.preference.MoviePreferenceDto
import io.github.kunal26das.yify.movies.data.preference.MoviePreferencesImpl
import io.github.kunal26das.yify.movies.data.repo.MovieRepositoryImpl
import io.github.kunal26das.yify.movies.data.service.MovieService
import io.github.kunal26das.yify.movies.data.service.MovieServiceImpl
import io.github.kunal26das.yify.movies.domain.logger.ExceptionLogger
import io.github.kunal26das.yify.movies.domain.preference.DataStoreCreator
import io.github.kunal26das.yify.movies.domain.preference.DataStoreFileProducer
import io.github.kunal26das.yify.movies.domain.preference.MoviePreferences
import io.github.kunal26das.yify.movies.domain.repo.MovieRepository
import kotlinx.serialization.json.Json
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class MoviesDataModule {

    @Binds
    abstract fun bindsMovieService(
        movieServiceImpl: MovieServiceImpl
    ): MovieService

    @Binds
    internal abstract fun bindMovieRepository(
        movieRepository: MovieRepositoryImpl
    ): MovieRepository

    @Binds
    abstract fun bindsMoviePreferences(
        moviePreferencesImpl: MoviePreferencesImpl
    ): MoviePreferences

    companion object {

        private const val MOVIE_PREFERENCE_JSON = "movie_preference.json"

        @Provides
        @Singleton
        fun providesMoviePreferenceDataStore(
            dataStoreProducer: DataStoreFileProducer,
            exceptionLogger: ExceptionLogger,
            json: Json,
        ): DataStore<MoviePreferenceDto?> {
            return DataStoreCreator.create(
                json = json,
                exceptionLogger = exceptionLogger,
                dataStoreFileProducer = dataStoreProducer,
                fileName = MOVIE_PREFERENCE_JSON,
                serializationStrategy = MoviePreferenceDto.serializer(),
                deserializationStrategy = MoviePreferenceDto.serializer(),
            )
        }
    }
}