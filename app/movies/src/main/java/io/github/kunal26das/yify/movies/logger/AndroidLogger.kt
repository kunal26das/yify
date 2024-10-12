package io.github.kunal26das.yify.movies.logger

import android.util.Log
import io.github.kunal26das.yify.movies.domain.logger.Logger
import io.github.kunal26das.yify.movies.domain.logger.Priority

internal class AndroidLogger() : Logger {
    override fun log(
        priority: Priority,
        tag: String,
        message: String?,
        throwable: Throwable?,
    ) {
        when (priority) {
            Priority.Debug -> Log.d(tag, message, throwable)
            Priority.Error -> Log.e(tag, message, throwable)
            Priority.Warn -> Log.w(tag, message, throwable)
            Priority.Verbose -> Log.v(tag, message, throwable)
            Priority.Info -> Log.i(tag, message, throwable)
        }
    }
}