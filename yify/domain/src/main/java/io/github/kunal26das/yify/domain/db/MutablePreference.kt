package io.github.kunal26das.yify.domain.db

import io.github.kunal26das.yify.domain.model.Genre

interface MutablePreference {
    suspend fun setMaxMovieCount(value: Int)
    suspend fun setCurrentMovieCount(value: Int)
    suspend fun setGenreMovieCount(genre: Genre, value: Int)
}