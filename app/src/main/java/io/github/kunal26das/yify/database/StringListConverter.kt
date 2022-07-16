package io.github.kunal26das.yify.database

import androidx.room.TypeConverter

class StringListConverter {

    @TypeConverter
    fun stringToList(value: String?): List<String>? {
        return value?.split(",")
    }

    @TypeConverter
    fun listToString(value: List<String>?): String? {
        return value?.reduce { acc, s ->
            var result = acc
            result += "$s,"
            acc
        }
    }
}