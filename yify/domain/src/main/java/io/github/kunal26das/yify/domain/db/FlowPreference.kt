package io.github.kunal26das.yify.domain.db

import io.github.kunal26das.yify.domain.model.Genre
import kotlinx.coroutines.flow.Flow

interface FlowPreference {
    fun getMovieCount(genre: Genre?): Flow<Int?>
}