package io.github.kunal26das.yify.converter

import androidx.room.TypeConverter
import io.github.kunal26das.model.Torrent
import io.github.kunal26das.yify.database.YifyDatabase

class TorrentConverter {

    private val yifyDatabase
        get() = YifyDatabase.INSTANCE

    @TypeConverter
    fun stringToTorrents(value: String?): List<Torrent>? {
        return value?.split(",")?.let {
            yifyDatabase.torrentDao.getTorrents(it)
        }
    }

    @TypeConverter
    fun torrentsToString(value: List<Torrent>?): String? {
        return value?.map {
            it.hash
        }?.reduce { acc, hash ->
            var result = acc
            result += "$hash,"
            result
        }
    }

}