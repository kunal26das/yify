package io.github.kunal26das.yify.db

import androidx.room.Database
import androidx.room.RoomDatabase
import io.github.kunal26das.yify.domain.db.MovieDao
import io.github.kunal26das.yify.domain.entity.MovieEntity

@Database(
    entities = [
        MovieEntity::class
    ],
    exportSchema = false,
    version = 1,
)
abstract class YifyDatabase : RoomDatabase() {
    abstract val movieDao: MovieDao
}