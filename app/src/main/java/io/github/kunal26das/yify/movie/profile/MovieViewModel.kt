package io.github.kunal26das.yify.movie.profile

import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.yify.models.Movie
import io.github.kunal26das.yify.repository.MovieRepository
import javax.inject.Inject

@HiltViewModel
class MovieViewModel @Inject constructor(
    private val movieRepository: MovieRepository,
) : ViewModel() {

    val movieSuggestions = MutableLiveData<List<Movie>>()

    fun getMovieSuggestions(movie: Movie) {
        movieRepository.getMovieSuggestions(movie) {
            movieSuggestions.value = it
        }
    }

    override fun onCleared() {
        movieRepository.close()
        super.onCleared()
    }

}