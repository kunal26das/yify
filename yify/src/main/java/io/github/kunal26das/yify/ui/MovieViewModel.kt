package io.github.kunal26das.yify.ui

import androidx.media3.common.Player
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.common.core.ViewModel
import io.github.kunal26das.yify.usecase.MovieUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

@HiltViewModel
class MovieViewModel @Inject constructor(
    private val movieUseCase: MovieUseCase,
    val player: Player,
) : ViewModel() {

    private val movieId = MutableStateFlow(0)

    init {
        player.prepare()
    }

    val movie = movieId.map {
        movieUseCase.getMovie(it).getOrNull()
    }.stateIn()

    fun getMovie(movieId: Int) {
        this.movieId.value = movieId
    }

    override fun onCleared() {
        player.release()
        super.onCleared()
    }
}