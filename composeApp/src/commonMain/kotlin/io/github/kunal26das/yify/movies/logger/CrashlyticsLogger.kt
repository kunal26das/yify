package io.github.kunal26das.yify.movies.logger

import io.github.kunal26das.yify.movies.domain.logger.ExceptionLogger

internal class CrashlyticsLogger(
) : ExceptionLogger {

    override fun log(throwable: Throwable) {
        throwable.printStackTrace()
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