package io.github.kunal26das.yify.movies.data.preference

import androidx.datastore.core.DataStore
import io.github.kunal26das.yify.movies.data.mapper.toMoviePreference
import io.github.kunal26das.yify.movies.data.mapper.toMoviePreferenceDto
import io.github.kunal26das.yify.movies.domain.preference.MoviePreference
import io.github.kunal26das.yify.movies.domain.preference.MoviePreferences
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class MoviePreferencesImpl @Inject constructor(
    private val moviePreferenceDataStore: DataStore<MoviePreferenceDto?>
) : MoviePreferences {
    override fun getMoviePreferenceFlow(): Flow<MoviePreference?> {
        return moviePreferenceDataStore.data.map {
            it?.toMoviePreference()
        }
    }

    override suspend fun getMoviePreference(): MoviePreference? {
        return getMoviePreferenceFlow().firstOrNull()
    }

    override suspend fun setMoviePreference(moviePreference: MoviePreference?) {
        updateMoviePreference { moviePreference }
    }

    override suspend fun updateMoviePreference(
        transform: (MoviePreference?) -> MoviePreference?,
    ) {
        moviePreferenceDataStore.updateData {
            transform.invoke(it?.toMoviePreference())?.toMoviePreferenceDto()
        }
    }
}