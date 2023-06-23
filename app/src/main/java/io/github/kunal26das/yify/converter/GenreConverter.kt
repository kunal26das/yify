package io.github.kunal26das.yify.converter

import androidx.room.TypeConverter

class GenreConverter {

    @TypeConverter
    fun stringToList(value: String?): List<String>? {
        return value?.split(",")
    }

    @TypeConverter
    fun listToString(value: List<String>?): String? {
        return value?.joinToString(",")
    }
}