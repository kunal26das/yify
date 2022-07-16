package io.github.kunal26das.yify.movie.profile

import android.graphics.drawable.Drawable
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.palette.graphics.Palette
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.model.Movie
import io.github.kunal26das.yify.repository.MovieRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MovieViewModel @Inject constructor(
    private val movieRepository: MovieRepository,
) : ViewModel() {

    private var job: Job? = null
    val movie = MutableLiveData<Movie>()
    val palette = MutableLiveData<Palette>()
    val suggestions = MutableLiveData<List<Movie>>()

    fun refresh(movieId: Int?) {
        if (movieId != null) {
            getMovie(movieId)
            getMovieSuggestions(movieId)
        }
    }

    fun getMovie(movieId: Int) {
        job = viewModelScope.launch {
            movie.postValue(movieRepository.getMovie(movieId))
        }
    }

    fun getMovieSuggestions(movieId: Int) {
        job = viewModelScope.launch {
            suggestions.postValue(movieRepository.getMovieSuggestions(movieId))
        }
    }

    fun generatePalette(drawable: Drawable) {
        job = viewModelScope.launch {
            palette.postValue(movieRepository.generatePalette(drawable))
        }
    }

    override fun onCleared() {
        super.onCleared()
        job?.cancel()
    }

}