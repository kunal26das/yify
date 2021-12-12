package io.github.kunal26das.yify.database

import androidx.room.Database
import io.github.kunal26das.core.model.Movie
import io.github.kunal26das.core.network.local.RoomDatabaseImpl
import io.github.kunal26das.yify.BuildConfig

@Database(
    exportSchema = true,
    entities = [Movie::class],
    version = BuildConfig.VERSION_CODE,
)
abstract class MovieDatabase : RoomDatabaseImpl<MovieDao>()