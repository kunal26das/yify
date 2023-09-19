package io.github.kunal26das.yify.domain.db

import io.github.kunal26das.yify.domain.model.Genre

interface ImmutablePreference {
    suspend fun getMovieCount(genre: Genre? = null): Int?
}