package io.github.kunal26das.yify.movies.domain.logger

interface Logger {
    fun log(
        priority: Priority,
        tag: String,
        message: String? = null,
        throwable: Throwable? = null
    )
}