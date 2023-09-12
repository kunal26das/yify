package io.github.kunal26das.yify.db

import androidx.room.TypeConverter
import io.github.kunal26das.yify.domain.model.Genre

class GenreConverter {

    private val separator = "|"

    @TypeConverter
    fun fromGenres(genres: List<Genre>?): String {
        return genres?.joinToString(separator) { it.name }.orEmpty()
    }

    @TypeConverter
    fun toGenres(genres: String?): List<Genre> {
        return genres?.split(separator)?.mapNotNull { Genre[it] }.orEmpty()
    }
}