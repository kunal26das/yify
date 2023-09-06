package io.github.kunal26das.yify.di

import android.content.Context
import androidx.room.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.yify.db.YifyDatabase
import io.github.kunal26das.yify.domain.db.MovieDao

@Module
@InstallIn(SingletonComponent::class)
object YifyModule {
    @Provides
    fun provideYifyDatabase(
        @ApplicationContext context: Context
    ): YifyDatabase {
        return Room.databaseBuilder(
            context = context,
            klass = YifyDatabase::class.java,
            name = "yify.db",
        ).build()
    }

    @Provides
    fun providesMovieDao(
        yifyDatabase: YifyDatabase
    ): MovieDao {
        return yifyDatabase.movieDao
    }
}