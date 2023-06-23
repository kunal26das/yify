package io.github.kunal26das.yify.hilt

import android.content.Context
import androidx.room.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.yify.database.CastDao
import io.github.kunal26das.yify.database.MovieDao
import io.github.kunal26das.yify.database.TorrentDao
import io.github.kunal26das.yify.database.YifyDatabase

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    @Provides
    fun providesYifyDatabase(
        @ApplicationContext context: Context,
    ): YifyDatabase {
        val builder = Room.databaseBuilder(
            context,
            YifyDatabase::class.java,
            context.packageName
        )
        return builder.build()
    }

    @Provides
    fun providesCastDao(
        yifyDatabase: YifyDatabase
    ): CastDao {
        return yifyDatabase.castDao
    }

    @Provides
    fun providesMovieDao(
        yifyDatabase: YifyDatabase
    ): MovieDao {
        return yifyDatabase.movieDao
    }

    @Provides
    fun providesTorrentDao(
        yifyDatabase: YifyDatabase
    ): TorrentDao {
        return yifyDatabase.torrentDao
    }
}