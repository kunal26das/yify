package io.github.kunal26das.yify.domain.db

interface MutablePreference {
    suspend fun setMaxMovieCount(value: Int)
    suspend fun setCurrentMovieCount(value: Int)
}