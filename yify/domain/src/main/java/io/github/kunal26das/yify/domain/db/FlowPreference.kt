package io.github.kunal26das.yify.domain.db

import kotlinx.coroutines.flow.Flow

interface FlowPreference {
    fun getMaxMovieCount(): Flow<Int?>
    fun getCurrentMovieCount(): Flow<Int?>
}