package io.github.kunal26das.yify.domain.db

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import io.github.kunal26das.yify.domain.entity.TorrentEntity

@Dao
interface TorrentDao {
    @Upsert
    suspend fun upsert(torrents: List<TorrentEntity>)

    @Query("SELECT * FROM TORRENT WHERE :id == MOVIE_ID")
    suspend fun getTorrents(id: Int): List<TorrentEntity>
}