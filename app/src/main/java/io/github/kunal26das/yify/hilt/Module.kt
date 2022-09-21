
package io.github.kunal26das.yify.hilt

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
@Suppress("HasPlatformType")
@InstallIn(SingletonComponent::class)
object Module {

    private val yifyDatabase
        get() = YifyDatabase.INSTANCE

    private val yifyRetrofit
        get() = YifyRetrofit.INSTANCE

    @Provides
    fun getCastDao() = yifyDatabase.castDao

    @Provides
    fun getMovieDao() = yifyDatabase.movieDao

    @Provides
    fun getTorrentDao() = yifyDatabase.torrentDao

    @Provides
    fun getMovieService() = yifyRetrofit.create(MovieService::class.java)

    @Provides
    fun getSharedPreferences(
        @ApplicationContext context: Context
    ) = context.getSharedPreferences(context.packageName, Context.MODE_PRIVATE)

}