package io.github.kunal26das.yify.movies.logger

import com.google.firebase.crashlytics.FirebaseCrashlytics
import io.github.kunal26das.yify.movies.domain.logger.ExceptionLogger

internal class CrashlyticsLogger(
    private val crashlytics: FirebaseCrashlytics,
) : ExceptionLogger {

    override fun log(throwable: Throwable) {
        crashlytics.recordException(throwable)
    }

    override suspend fun <T> runCatching(
        tryBlock: suspend () -> T
    ): Result<T> {
        return try {
            val result = tryBlock.invoke()
            Result.success(result)
        } catch (e: Throwable) {
            log(e)
            Result.failure(e)
        }
    }
}