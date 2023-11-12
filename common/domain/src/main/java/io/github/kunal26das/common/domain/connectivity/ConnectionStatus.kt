package io.github.kunal26das.common.domain.connectivity

import androidx.annotation.Keep

@Keep
enum class ConnectionStatus {
    Available, Unavailable, Losing, Lost,
}