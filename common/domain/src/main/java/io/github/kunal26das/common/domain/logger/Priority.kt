package io.github.kunal26das.common.domain.logger

enum class Priority(
    val value: Int,
) {
    Debug(3),
    Error(6),
    Info(4),
    Warn(5),
    Verbose(2),
}