package io.github.kunal26das.yify.movies.presentation

import androidx.lifecycle.viewModelScope
import androidx.paging.cachedIn
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.common.core.YifyViewModel
import io.github.kunal26das.yify.movies.domain.model.Genre
import io.github.kunal26das.yify.movies.domain.model.OrderBy
import io.github.kunal26das.yify.movies.domain.model.Quality
import io.github.kunal26das.yify.movies.domain.model.SortBy
import io.github.kunal26das.yify.movies.domain.preference.MoviePreference
import io.github.kunal26das.yify.movies.usecase.MoviesPagerUseCase
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.update
import javax.inject.Inject

@HiltViewModel
@OptIn(FlowPreview::class)
class MoviesViewModel @Inject constructor(
    private val moviesPagerUseCase: MoviesPagerUseCase,
) : YifyViewModel() {

    private val _searchQuery = MutableStateFlow("")
    val searchQuery = _searchQuery.asStateFlow()

    val moviePreference = MutableStateFlow(MoviePreference.Default)

    private val _moviesCount = MutableStateFlow<Long>(0)
    val moviesCount = _moviesCount.asStateFlow()

    @OptIn(ExperimentalCoroutinesApi::class)
    val uncategorizedMovies = searchQuery
        .debounce(DEBOUNCE_TIMEOUT)
        .combine(moviePreference) { searchQuery, moviePreference ->
            moviesPagerUseCase.getMoviesPagingData(
                moviePreference = moviePreference.copy(queryTerm = searchQuery),
                onFirstLoad = { _moviesCount.value = it }
            ).cachedIn(viewModelScope)
        }.flatMapLatest { it }

    fun search(searchQuery: String?) {
        _searchQuery.value = searchQuery.orEmpty()
    }

    fun setGenre(genre: Genre?) {
        moviePreference.update {
            it.copy(genre = genre)
        }
    }

    fun setQuality(quality: Quality?) {
        moviePreference.update {
            it.copy(quality = quality ?: MoviePreference.Default.quality)
        }
    }

    fun setSortBy(sortBy: SortBy?) {
        moviePreference.update {
            it.copy(sortBy = sortBy ?: MoviePreference.Default.sortBy)
        }
    }

    fun setOrderBy(orderBy: OrderBy?) {
        moviePreference.update {
            it.copy(orderBy = orderBy ?: MoviePreference.Default.orderBy)
        }
    }

    fun setMinimumRating(rating: Int?) {
        moviePreference.update {
            it.copy(minimumRating = rating ?: MoviePreference.Default.minimumRating)
        }
    }

    fun clear() {
        _searchQuery.update { "" }
        moviePreference.update { MoviePreference.Default }
    }

    companion object {
        private const val DEBOUNCE_TIMEOUT = 1750L
    }
}