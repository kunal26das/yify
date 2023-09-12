package io.github.kunal26das.yify.db.converter

import androidx.room.TypeConverter
import io.github.kunal26das.yify.domain.model.Quality

class QualityConverter {

    @TypeConverter
    fun fromQuality(quality: Quality?): Int {
        return quality?.value ?: Quality.Unknown.value
    }

    @TypeConverter
    fun toQuality(quality: Int?): Quality {
        return Quality[quality] ?: Quality.Unknown
    }
}