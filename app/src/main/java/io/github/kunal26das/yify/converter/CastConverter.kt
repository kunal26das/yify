package io.github.kunal26das.yify.converter

import androidx.room.TypeConverter
import io.github.kunal26das.model.Cast
import io.github.kunal26das.yify.database.YifyDatabase

class CastConverter {

    private val yifyDatabase
        get() = YifyDatabase.INSTANCE

    @TypeConverter
    fun stringToCast(value: String?): List<Cast>? {
        return value?.split(",")?.let {
            yifyDatabase.castDao.getCast(it)
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