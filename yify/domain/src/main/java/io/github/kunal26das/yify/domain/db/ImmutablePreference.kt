package io.github.kunal26das.yify.domain.db

import io.github.kunal26das.yify.domain.model.Genre

interface ImmutablePreference {
    suspend fun getMaxMovieCount(): Int?
    suspend fun getCurrentMovieCount(): Int?
    suspend fun getGenreMovieCount(genre: Genre, value: Int): Int?
}