package io.github.kunal26das.yify.ui

import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import androidx.paging.cachedIn
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.common.core.ViewModel
import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.MoviePreference
import io.github.kunal26das.yify.domain.repo.MovieRepository
import io.github.kunal26das.yify.usecase.MoviesPagerUseCase
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class NetflixViewModel @Inject constructor(
    private val movieRepository: MovieRepository,
    private val moviesPagerUseCase: MoviesPagerUseCase,
) : ViewModel() {

    private val _genreCount = MutableStateFlow(listOf<Int>())
    val movieGenreCount = _genreCount.asStateFlow()

    fun getMovieGenreCounts(genres: Array<Genre>) {
        viewModelScope.launch {
            _genreCount.value = genres.map {
                async { movieRepository.getRemoteMoviesCount(it) }
            }.awaitAll()
        }
    }

    fun getMovieGenreFlows(
        genres: Array<Genre>,
    ): List<Flow<PagingData<Movie>>> {
        return genres.map {
            moviesPagerUseCase
                .getMoviesPagingData(MoviePreference.Default.copy(genre = it))
                .cachedIn(viewModelScope)
        }
    }
}