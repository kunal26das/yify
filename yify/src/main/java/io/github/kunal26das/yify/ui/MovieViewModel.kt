package io.github.kunal26das.yify.ui

import androidx.lifecycle.viewModelScope
import androidx.media3.common.Player
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.common.core.ViewModel
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.repo.MovieRepository
import io.github.kunal26das.yify.usecase.MovieUseCase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MovieViewModel @Inject constructor(
    private val movieUseCase: MovieUseCase,
    private val movieRepository: MovieRepository,
    val player: Player,
) : ViewModel() {

    private val _movie = MutableStateFlow<Movie?>(null)
    val movie = _movie.asStateFlow()

    private val _movieSuggestions = MutableStateFlow<List<Movie>?>(null)
    val movieSuggestions = _movieSuggestions.asStateFlow()

    init {
        player.prepare()
    }

    fun getMovie(movieId: Int) {
        viewModelScope.launch(Dispatchers.IO) {
            val movie = async { movieUseCase.getMovie(movieId) }
            val suggestions = async { movieRepository.getMovieSuggestions(movieId) }
            _movie.value = movie.await().getOrNull()
            _movieSuggestions.value = suggestions.await().getOrNull()
        }
    }

    override fun onCleared() {
        player.release()
        super.onCleared()
    }
}