package io.github.kunal26das.yify.database

import android.content.Context
import androidx.essentials.network.local.RoomDatabaseBuilder
import dagger.hilt.android.qualifiers.ApplicationContext

class MovieDatabaseBuilder(
    @ApplicationContext context: Context
) : RoomDatabaseBuilder<MovieDatabase>(context, MovieDatabase::class)