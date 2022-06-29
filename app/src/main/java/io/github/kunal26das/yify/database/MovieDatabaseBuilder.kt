package io.github.kunal26das.yify.database

import android.content.Context
import androidx.essentials.network.RoomDatabaseBuilder
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.kunal26das.model.Movie.Companion.KEY_MOVIE
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MovieDatabaseBuilder @Inject constructor(
    @ApplicationContext context: Context
) : RoomDatabaseBuilder<MovieDatabase>(
    context, MovieDatabase::class, KEY_MOVIE, {
        fallbackToDestructiveMigration()
    }
)