package io.github.kunal26das.yify.ui

import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.common.core.ViewModel
import io.github.kunal26das.yify.domain.db.YifyDatabase
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.repo.MovieRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MovieViewModel @Inject constructor(
    private val yifyDatabase: YifyDatabase,
    private val movieRepository: MovieRepository,
) : ViewModel() {

    private val _movie = MutableStateFlow<Movie?>(null)
    val movie = _movie.asStateFlow()

    private val _movieSuggestions = MutableStateFlow<List<Movie>?>(null)
    val movieSuggestions = _movieSuggestions.asStateFlow()

    fun getMovie(movieId: Int) {
        viewModelScope.launch(Dispatchers.IO) {
            val movie = async { yifyDatabase.getMovie(movieId) }
            val suggestions = async { movieRepository.getMovieSuggestions(movieId) }
            _movie.value = movie.await()
            _movieSuggestions.value = suggestions.await().getOrNull()
        }
    }
}