package io.github.kunal26das.yify.movie.list

import android.content.SharedPreferences
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.yify.movie.filter.Filters
import io.github.kunal26das.yify.repository.MovieRepository
import io.github.kunal26das.yify.source.AllMovies
import javax.inject.Inject

@HiltViewModel
class AllMoviesViewModel @Inject constructor(
    private val movieRepository: MovieRepository,
    private val sharedPreferences: SharedPreferences,
) : MovieListViewModel() {

    init {
        refresh()
    }

    override fun refresh(delayTimeMillis: Long) {
        super.refresh(delayTimeMillis) {
            AllMovies(movieRepository, Filters(sharedPreferences))
        }
    }

}