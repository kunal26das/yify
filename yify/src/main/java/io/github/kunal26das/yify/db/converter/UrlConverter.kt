package io.github.kunal26das.yify.db.converter

import androidx.room.TypeConverter

class UrlConverter {

    private val separator = "|"

    @TypeConverter
    fun fromUrl(urls: List<String>?): String {
        return urls?.joinToString(separator) { it }.orEmpty()
    }

    @TypeConverter
    fun toQuality(urls: String?): List<String> {
        return urls?.split(separator).orEmpty()
    }
}