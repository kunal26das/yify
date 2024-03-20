package io.github.kunal26das.yify.movies.domain.preference

import kotlinx.coroutines.flow.Flow

interface MoviePreferences {
    fun getMoviePreferenceFlow(): Flow<MoviePreference?>
    suspend fun getMoviePreference(): MoviePreference?
    suspend fun setMoviePreference(moviePreference: MoviePreference?)
    suspend fun updateMoviePreference(transform: (MoviePreference?) -> MoviePreference?)
}