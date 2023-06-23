package io.github.kunal26das.yify.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy.Companion.REPLACE
import androidx.room.Query
import io.github.kunal26das.model.Torrent

@Dao
interface TorrentDao {

    @Insert(onConflict = REPLACE)
    suspend fun insert(torrent: Torrent)

    @Insert(onConflict = REPLACE)
    suspend fun insert(movies: List<Torrent>)

    @Query("SELECT * FROM Torrent WHERE hash IN (:ids)")
    fun getTorrents(ids: List<String>): List<Torrent>

}