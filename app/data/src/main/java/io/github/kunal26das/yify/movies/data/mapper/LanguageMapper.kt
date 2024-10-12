package io.github.kunal26das.yify.movies.data.mapper

import io.github.kunal26das.yify.movies.data.UnknownLanguageException
import io.github.kunal26das.yify.movies.domain.logger.ExceptionLogger
import io.github.kunal26das.yify.movies.domain.logger.Logger
import io.github.kunal26das.yify.movies.domain.logger.Priority
import io.github.kunal26das.yify.movies.domain.model.Language
import java.util.Locale

internal class LanguageMapper(
    private val exceptionLogger: ExceptionLogger,
    private val logger: Logger,
) {
    fun toLanguage(
        languageCode: String?,
    ): Language {
        if (languageCode == null) {
            return Language.Unknown
        }
        val locale = Locale(languageCode)
        val language = locale.displayLanguage
        val enum = Language[language]
        if (enum == null) {
            logger.log(Priority.Debug, "Unknown Language", language)
            exceptionLogger.log(UnknownLanguageException(language))
        }
        return enum ?: Language.Unknown
    }
}