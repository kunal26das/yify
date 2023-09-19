package io.github.kunal26das.yify.domain.db

import io.github.kunal26das.yify.domain.model.Genre

interface MutablePreference {
    suspend fun setMovieCount(value: Int, genre: Genre? = null)
}