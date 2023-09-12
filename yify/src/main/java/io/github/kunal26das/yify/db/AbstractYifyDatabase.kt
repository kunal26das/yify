package io.github.kunal26das.yify.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.room.withTransaction
import io.github.kunal26das.yify.db.converter.QualityConverter
import io.github.kunal26das.yify.domain.db.MovieDao
import io.github.kunal26das.yify.domain.db.TorrentDao
import io.github.kunal26das.yify.domain.db.YifyDatabase
import io.github.kunal26das.yify.domain.entity.MovieEntity
import io.github.kunal26das.yify.domain.entity.TorrentEntity

@Database(
    entities = [
        MovieEntity::class,
        TorrentEntity::class,
    ],
    exportSchema = false,
    version = 1,
)
@TypeConverters(
    GenreConverter::class,
    QualityConverter::class,
)
abstract class AbstractYifyDatabase : RoomDatabase(), YifyDatabase {
    abstract override val torrentDao: TorrentDao
    abstract override val movieDao: MovieDao
    override suspend fun <T> transaction(
        block: suspend YifyDatabase.() -> T,
    ) = withTransaction {
        block.invoke(this)
    }
}