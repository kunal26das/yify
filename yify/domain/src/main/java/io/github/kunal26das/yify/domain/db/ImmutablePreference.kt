package io.github.kunal26das.yify.domain.db

interface ImmutablePreference {
    suspend fun getMaxMovieCount(): Int?
    suspend fun getCurrentMovieCount(): Int?
}