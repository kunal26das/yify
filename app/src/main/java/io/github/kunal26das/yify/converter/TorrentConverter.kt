package io.github.kunal26das.yify.converter

import androidx.room.TypeConverter
import io.github.kunal26das.model.Torrent
import io.github.kunal26das.yify.database.YifyDatabase

class TorrentConverter constructor(
    private val yifyDatabase: YifyDatabase
) {

    @TypeConverter
    fun stringToTorrents(value: String?): List<Torrent>? {
        return value?.split(",")?.let {
            yifyDatabase.torrentDao.getTorrents(it)
        }
    }

    @TypeConverter
    fun torrentsToString(value: List<Torrent>?): String? {
        return value?.joinToString { "${it.hash}," }
    }

}