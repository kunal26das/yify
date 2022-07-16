package io.github.kunal26das.yify.database

import androidx.room.TypeConverter
import io.github.kunal26das.model.Cast

class CastConverter {

    @TypeConverter
    fun stringToCast(value: String?): List<Cast>? {
        return value?.split(",")?.let {
            YifyDatabase.INSTANCE.castDao.getCast(it)
        }
    }

    @TypeConverter
    fun torrentsToCast(value: List<Cast>?): String? {
        return value?.map {
            it.imdbCode
        }?.reduce { acc, hash ->
            var result = acc
            result += "$hash,"
            result
        }
    }

}