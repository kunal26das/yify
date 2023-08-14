package io.github.kunal26das.yify.movie.list

import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.yify.preference.Filters
import io.github.kunal26das.yify.preference.MoviePreferences
import io.github.kunal26das.yify.repository.MovieRepository
import io.github.kunal26das.yify.source.AllMoviesSource
import javax.inject.Inject

@HiltViewModel
class AllMoviesViewModel @Inject constructor(
    private val movieRepository: MovieRepository,
    private val moviePreferences: MoviePreferences,
) : MovieListViewModel() {

    init {
        refresh()
    }

    override suspend fun refreshInternal(delayTimeMillis: Long) {
        super.refresh(delayTimeMillis) {
            AllMoviesSource(movieRepository, Filters(moviePreferences))
        }
    }

}