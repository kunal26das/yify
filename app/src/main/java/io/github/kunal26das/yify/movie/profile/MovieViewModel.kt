package io.github.kunal26das.yify.movie.profile

import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
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
    val movieSuggestions = MutableLiveData<List<Movie>>()

    fun getMovie(movie: Movie) {
        this.movie.value = movie
        job = viewModelScope.launch {
            val movie = movieRepository.getMovie(movie.id)
            this@MovieViewModel.movie.postValue(movie)
        }
    }

    fun getMovieSuggestions(movie: Movie) {
        job = viewModelScope.launch {
            val movies = movieRepository.getMovieSuggestions(movie)
            movieSuggestions.postValue(movies)
        }
    }

    override fun onCleared() {
        super.onCleared()
        job?.cancel()
    }

}