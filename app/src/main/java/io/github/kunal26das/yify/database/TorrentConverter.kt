package io.github.kunal26das.yify.database

import androidx.room.TypeConverter
import io.github.kunal26das.model.Torrent

class TorrentConverter {

    @TypeConverter
    fun stringToTorrents(value: String?): List<Torrent>? {
        return value?.split(",")?.let {
            YifyDatabase.INSTANCE.torrentDao.getTorrents(it)
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