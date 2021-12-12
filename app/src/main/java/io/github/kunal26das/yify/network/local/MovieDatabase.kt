package io.github.kunal26das.yify.network.local

import androidx.room.Database
import io.github.kunal26das.yify.BuildConfig
import io.github.kunal26das.yify.models.Movie

@Database(
    exportSchema = true,
    entities = [Movie::class],
    version = BuildConfig.VERSION_CODE,
)
abstract class MovieDatabase : RoomDatabaseImpl<MovieDao>()