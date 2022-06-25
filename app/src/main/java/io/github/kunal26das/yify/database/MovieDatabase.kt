package io.github.kunal26das.yify.database

import androidx.room.Database
import androidx.room.RoomDatabase
import io.github.kunal26das.model.Movie
import io.github.kunal26das.yify.BuildConfig

@Database(
    exportSchema = true,
    entities = [Movie::class],
    version = BuildConfig.VERSION_CODE,
)
abstract class MovieDatabase : RoomDatabase() {
    abstract val dao: MovieDao
}