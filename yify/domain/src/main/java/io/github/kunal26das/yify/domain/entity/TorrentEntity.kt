package io.github.kunal26das.yify.domain.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import io.github.kunal26das.yify.domain.model.Quality

@Entity("torrent")
data class TorrentEntity constructor(
    @PrimaryKey
    @ColumnInfo("hash")
    val hash: String,
    @ColumnInfo("movie_id")
    val movieId: Int,
    @ColumnInfo("date_uploaded")
    val dateUploaded: Long?,
    @ColumnInfo("peers")
    val peers: Int?,
    @ColumnInfo("quality")
    val quality: Quality?,
    @ColumnInfo("seeds")
    val seeds: Int?,
    @ColumnInfo("size")
    val size: String?,
    @ColumnInfo("size_bytes")
    val sizeBytes: Long?,
    @ColumnInfo("type")
    val type: String?,
    @ColumnInfo("url")
    val url: String?,
)