package io.github.kunal26das.yify.db.converter

import androidx.room.TypeConverter
import io.github.kunal26das.yify.domain.model.Language

class LanguageConverter {

    @TypeConverter
    fun fromLanguage(language: Language?): String {
        return language?.name ?: Language.Unknown.name
    }

    @TypeConverter
    fun toLanguage(language: String?): Language {
        return Language[language] ?: Language.Unknown
    }
}