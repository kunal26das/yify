package io.github.kunal26das.yify.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.room.withTransaction
import io.github.kunal26das.yify.db.converter.GenreConverter
import io.github.kunal26das.yify.db.converter.LanguageConverter
import io.github.kunal26das.yify.db.converter.QualityConverter
import io.github.kunal26das.yify.db.converter.UrlConverter
import io.github.kunal26das.yify.domain.db.MovieDao
import io.github.kunal26das.yify.domain.db.TorrentDao
import io.github.kunal26das.yify.domain.db.YifyDatabase
import io.github.kunal26das.yify.domain.entity.MovieEntity
import io.github.kunal26das.yify.domain.entity.TorrentEntity
import io.github.kunal26das.yify.domain.mapper.toEntities
import io.github.kunal26das.yify.domain.mapper.toMovie
import io.github.kunal26das.yify.domain.mapper.toTorrents
import io.github.kunal26das.yify.domain.model.Movie

@Database(
    entities = [
        MovieEntity::class,
        TorrentEntity::class,
    ],
    exportSchema = false,
    version = 1,
)
@TypeConverters(
    UrlConverter::class,
    GenreConverter::class,
    QualityConverter::class,
    LanguageConverter::class,
)
abstract class AbstractYifyDatabase : RoomDatabase(), YifyDatabase {

    abstract override val movieDao: MovieDao
    abstract override val torrentDao: TorrentDao

    override suspend fun insertMovies(movies: List<Movie>) = withTransaction {
        movieDao.upsert(movies.toEntities)
        movies.flatMap {
            it.torrents
        }.let {
            torrentDao.upsert(it.toEntities)
        }
    }

    override suspend fun getMovie(movieId: Int): Movie? {
        val torrents = torrentDao.getTorrents(movieId).toTorrents
        return movieDao.getMovie(movieId)?.toMovie(torrents = torrents)
    }
}