package io.github.kunal26das.common.domain.connectivity

import kotlinx.coroutines.flow.Flow

interface ConnectivityObserver {
    fun observe(): Flow<ConnectionStatus>
}