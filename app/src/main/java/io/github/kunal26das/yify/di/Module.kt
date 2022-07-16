package io.github.kunal26das.yify.di

import android.content.Context
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.yify.database.YifyDatabase
import io.github.kunal26das.yify.network.YifyRetrofit
import io.github.kunal26das.yify.service.MovieService

@Module
@InstallIn(SingletonComponent::class)
object Module {

    @Provides
    fun getCastDao() = YifyDatabase.INSTANCE.castDao

    @Provides
    fun getMovieDao() = YifyDatabase.INSTANCE.movieDao

    @Provides
    fun getTorrentDao() = YifyDatabase.INSTANCE.torrentDao

    @Provides
    fun getMovieService(): MovieService {
        return YifyRetrofit.INSTANCE.create(MovieService::class.java)
    }

    @Provides
    fun getPreferences(
        @ApplicationContext context: Context
    ) = context.getSharedPreferences(context.packageName, Context.MODE_PRIVATE)!!

}