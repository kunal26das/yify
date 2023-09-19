package io.github.kunal26das.yify.ui

import androidx.datastore.core.DataStore
import androidx.lifecycle.viewModelScope
import androidx.paging.cachedIn
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.common.core.ViewModel
import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.MoviePreference
import io.github.kunal26das.yify.domain.model.OrderBy
import io.github.kunal26das.yify.domain.model.Quality
import io.github.kunal26das.yify.domain.model.SortBy
import io.github.kunal26das.yify.usecase.MoviesPagerUseCase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
@OptIn(FlowPreview::class)
class MoviesViewModel @Inject constructor(
    private val moviesPagerUseCase: MoviesPagerUseCase,
    private val uiPreferenceDataStore: DataStore<UiPreference>,
    private val moviePreferenceDataStore: DataStore<MoviePreference>,
) : ViewModel() {

    private val _searchQuery = MutableStateFlow("")
    val searchQuery = _searchQuery.asStateFlow()

    private val genres = MutableStateFlow(emptyList<Genre>())

    val uiPreference = uiPreferenceDataStore.data.stateIn(UiPreference.Uncategorised)
    val moviePreference = moviePreferenceDataStore.data.stateIn(MoviePreference.Default)

    @OptIn(ExperimentalCoroutinesApi::class)
    val uncategorizedMovies = combine(
        searchQuery,
        moviePreferenceDataStore.data,
    ) { searchQuery, moviePreference ->
        moviesPagerUseCase.getMoviesPagingData(moviePreference.copy(queryTerm = searchQuery))
    }.debounce(DEBOUNCE_TIMEOUT).flatMapLatest { it }.cachedIn(viewModelScope)

    val categorizedMovies = combine(
        searchQuery,
        genres,
        moviePreferenceDataStore.data,
    ) { searchQuery, genres, moviePreference ->
        genres.map {
            moviesPagerUseCase.getMoviesPagingData(
                moviePreference.copy(genre = it, queryTerm = searchQuery)
            ).cachedIn(viewModelScope)
        }
    }.debounce(DEBOUNCE_TIMEOUT).stateIn(emptyList())

    fun search(searchQuery: String?) {
        _searchQuery.value = searchQuery.orEmpty()
    }

    fun setGenre(genre: Genre?) {
        viewModelScope.launch(Dispatchers.IO) {
            moviePreferenceDataStore.updateData {
                it.copy(genre = genre)
            }
        }
    }

    fun setQuality(quality: Quality?) {
        viewModelScope.launch(Dispatchers.IO) {
            moviePreferenceDataStore.updateData {
                it.copy(quality = quality ?: MoviePreference.Default.quality)
            }
        }
    }

    fun setSortBy(sortBy: SortBy?) {
        viewModelScope.launch(Dispatchers.IO) {
            moviePreferenceDataStore.updateData {
                it.copy(sortBy = sortBy ?: MoviePreference.Default.sortBy)
            }
        }
    }

    fun setOrderBy(orderBy: OrderBy?) {
        viewModelScope.launch(Dispatchers.IO) {
            moviePreferenceDataStore.updateData {
                it.copy(orderBy = orderBy ?: MoviePreference.Default.orderBy)
            }
        }
    }

    fun setMinimumRating(rating: Int?) {
        viewModelScope.launch(Dispatchers.IO) {
            moviePreferenceDataStore.updateData {
                it.copy(minimumRating = rating ?: MoviePreference.Default.minimumRating)
            }
        }
    }

    fun setUserInterface(ui: Preview?) {
        viewModelScope.launch(Dispatchers.IO) {
            uiPreferenceDataStore.updateData {
                it.copy(preview = ui ?: UiPreference.Uncategorised.preview)
            }
        }
    }

    fun setGenres(genres: List<Genre>) {
        this.genres.value = genres
    }

    fun clear() {
        viewModelScope.launch(Dispatchers.IO) {
            moviePreferenceDataStore.updateData {
                MoviePreference.Default
            }
            _searchQuery.value = ""
        }
    }

    companion object {
        private const val DEBOUNCE_TIMEOUT = 1500L
    }
}