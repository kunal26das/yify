package io.github.kunal26das.common.domain.logger

interface Logger {
    fun log(
        priority: Priority,
        tag: String,
        message: String? = null,
        throwable: Throwable? = null
    )
}