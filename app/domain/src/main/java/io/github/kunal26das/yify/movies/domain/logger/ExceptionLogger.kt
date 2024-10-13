package io.github.kunal26das.yify.movies.domain.logger

interface ExceptionLogger {
    fun log(throwable: Throwable)
    suspend fun <T> runCatching(
        tryBlock: suspend () -> T,
    ): Result<T>
}