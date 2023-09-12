package io.github.kunal26das.common.connectivity

import io.github.kunal26das.common.model.ConnectionStatus
import kotlinx.coroutines.flow.Flow

interface ConnectivityObserver {
    fun observe(): Flow<ConnectionStatus>
}