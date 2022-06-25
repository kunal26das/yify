package io.github.kunal26das.yify

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.yify.network.YifyRetrofit
import io.github.kunal26das.yify.service.MovieService

@Module
@InstallIn(SingletonComponent::class)
object Module {

    @Provides
    fun getMovieService(): MovieService {
        return YifyRetrofit.getInstance().create(MovieService::class.java)
    }

}