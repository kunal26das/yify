package io.github.kunal26das.yify.data.mapper

import io.github.kunal26das.common.domain.logger.CrashLogger
import io.github.kunal26das.common.domain.logger.Logger
import io.github.kunal26das.common.domain.logger.Priority
import io.github.kunal26das.yify.data.UnknownLanguageException
import io.github.kunal26das.yify.domain.model.Language
import java.util.Locale
import javax.inject.Inject

internal class LanguageMapper @Inject constructor(
    private val crashLogger: CrashLogger,
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
            crashLogger.log(UnknownLanguageException(language))
        }
        return enum ?: Language.Unknown
    }
}