package io.github.kunal26das.yify.data.di

import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.yify.data.repo.MovieRepositoryImpl
import io.github.kunal26das.yify.data.service.MovieService
import io.github.kunal26das.yify.domain.repo.MovieRepository
import retrofit2.Retrofit

@Module
@InstallIn(SingletonComponent::class)
abstract class YifyDataModule {

    @Binds
    abstract fun bindMovieRepository(
        movieRepository: MovieRepositoryImpl
    ): MovieRepository

    companion object {
        @Provides
        fun getMovieService(
            retrofit: Retrofit
        ): MovieService = retrofit.create(MovieService::class.java)
    }
}