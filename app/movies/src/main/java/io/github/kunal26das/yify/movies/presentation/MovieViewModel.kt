package io.github.kunal26das.yify.movies.presentation

import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.common.core.YifyViewModel
import io.github.kunal26das.yify.movies.domain.model.Movie
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

@HiltViewModel
class MovieViewModel @Inject constructor(
) : YifyViewModel() {

    private val _movie = MutableStateFlow<Movie?>(null)
    val movie = _movie.asStateFlow()

    fun setMovie(movie: Movie?) {
        _movie.value = movie
    }
}