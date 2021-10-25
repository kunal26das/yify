package io.github.kunal26das.yify.service

import androidx.room.Database
import androidx.room.RoomDatabase
import io.github.kunal26das.yify.BuildConfig
import io.github.kunal26das.yify.models.Movie

@Database(
    exportSchema = true,
    entities = [Movie::class],
    version = BuildConfig.VERSION_CODE,
)
abstract class YifyDatabase : RoomDatabase() {
    abstract val movieDao: MovieDao
}