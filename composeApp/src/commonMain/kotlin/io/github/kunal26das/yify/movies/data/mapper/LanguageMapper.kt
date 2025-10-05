package io.github.kunal26das.yify.movies.data.mapper

import androidx.compose.ui.text.intl.Locale
import io.github.kunal26das.yify.movies.domain.logger.ExceptionLogger
import io.github.kunal26das.yify.movies.domain.model.Language

internal class LanguageMapper(
    private val exceptionLogger: ExceptionLogger,
) {
    fun toLanguage(
        languageCode: String?,
    ): Language {
        if (languageCode == null) {
            return Language.Unknown
        }
        val locale = Locale(languageCode)
        val language = locale.language
        val enum = Language[language]
//        if (enum == null) {
//            exceptionLogger.log(UnknownLanguageException(language))
//        }
        return enum ?: Language.Unknown
    }
}