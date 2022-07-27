package io.github.kunal26das.yify.database

import androidx.essentials.network.RoomDatabaseBuilder
import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import io.github.kunal26das.model.Cast
import io.github.kunal26das.model.Movie
import io.github.kunal26das.model.Torrent
import io.github.kunal26das.yify.BuildConfig
import io.github.kunal26das.yify.Yify
import io.github.kunal26das.yify.converter.CastConverter
import io.github.kunal26das.yify.converter.GenreConverter
import io.github.kunal26das.yify.converter.TorrentConverter

@Database(
    entities = [
        Cast::class,
        Movie::class,
        Torrent::class,
    ],
    exportSchema = true,
    version = BuildConfig.VERSION_CODE,
)
@TypeConverters(
    CastConverter::class,
    GenreConverter::class,
    TorrentConverter::class,
)
abstract class YifyDatabase : RoomDatabase() {

    abstract val castDao: CastDao
    abstract val movieDao: MovieDao
    abstract val torrentDao: TorrentDao

    companion object : RoomDatabaseBuilder<YifyDatabase>(
        Yify.INSTANCE, YifyDatabase::class,
        Yify::class.java.simpleName, {
            fallbackToDestructiveMigration()
        }
    )

}