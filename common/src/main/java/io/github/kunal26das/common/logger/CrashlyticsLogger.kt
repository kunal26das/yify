package io.github.kunal26das.common.logger

import com.google.firebase.crashlytics.FirebaseCrashlytics
import io.github.kunal26das.common.BuildConfig
import io.github.kunal26das.common.domain.logger.CrashLogger
import io.github.kunal26das.common.domain.logger.Logger
import io.github.kunal26das.common.domain.logger.Priority
import javax.inject.Inject

internal class CrashlyticsLogger @Inject constructor(
    private val crashlytics: FirebaseCrashlytics,
    private val logger: Logger,
) : CrashLogger {
    override fun log(throwable: Throwable) {
        if (BuildConfig.DEBUG) {
            logger.log(Priority.Debug, throwable::class.java.name, throwable.message, throwable)
        }
        crashlytics.recordException(throwable)
    }
}