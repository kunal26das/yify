package io.github.kunal26das.common.logger

import com.google.firebase.crashlytics.FirebaseCrashlytics
import io.github.kunal26das.common.domain.logger.CrashLogger
import javax.inject.Inject

internal class CrashlyticsLogger @Inject constructor(
    private val crashlytics: FirebaseCrashlytics,
) : CrashLogger {
    override fun log(throwable: Throwable) {
        crashlytics.recordException(throwable)
    }
}