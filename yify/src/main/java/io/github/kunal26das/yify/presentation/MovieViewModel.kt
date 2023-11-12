package io.github.kunal26das.yify.presentation

import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.common.core.ViewModel
import io.github.kunal26das.yify.domain.model.Movie
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

@HiltViewModel
class MovieViewModel @Inject constructor(
) : ViewModel() {

    private val _movie = MutableStateFlow<Movie?>(null)
    val movie = _movie.asStateFlow()

    fun setMovie(movie: Movie?) {
        _movie.value = movie
    }
}