package io.github.kunal26das.yify.movie.profile

import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.model.Movie
import io.github.kunal26das.yify.repository.MovieRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MovieViewModel @Inject constructor(
    private val movieRepository: MovieRepository,
) : ViewModel() {

    private var job: Job? = null
    val movieSuggestions = MutableLiveData<List<Movie>>()
    private val coroutineScope = CoroutineScope(Dispatchers.Default)

    fun getMovieSuggestions(movie: Movie) {
        job = coroutineScope.launch {
            val movies = movieRepository.getMovieSuggestions(movie)
            movieSuggestions.postValue(movies)
        }
    }

    override fun onCleared() {
        super.onCleared()
        job?.cancel()
    }

}