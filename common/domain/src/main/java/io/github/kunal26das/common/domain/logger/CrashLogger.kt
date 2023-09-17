package io.github.kunal26das.common.domain.logger

interface CrashLogger {
    fun log(throwable: Throwable)
}