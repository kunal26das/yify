package io.github.kunal26das.yify.database

import android.content.Context
import androidx.essentials.network.local.RoomDatabaseBuilder
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MovieDatabaseBuilder @Inject constructor(
    @ApplicationContext context: Context
) : RoomDatabaseBuilder<MovieDatabase>(
    context, MovieDatabase::class
)