package io.github.kunal26das.yify.ui

import androidx.datastore.core.DataStore
import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import androidx.paging.cachedIn
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.common.core.ViewModel
import io.github.kunal26das.yify.domain.db.FlowPreference
import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.MoviePreference
import io.github.kunal26das.yify.domain.model.OrderBy
import io.github.kunal26das.yify.domain.model.Quality
import io.github.kunal26das.yify.domain.model.SortBy
import io.github.kunal26das.yify.usecase.MoviesPagerUseCase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.Flow
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
    immutablePreference: FlowPreference,
    private val moviesPagerUseCase: MoviesPagerUseCase,
    private val uiPreferenceDataStore: DataStore<UiPreference>,
    private val moviePreferenceDataStore: DataStore<MoviePreference>,
) : ViewModel() {

    private val _searchQuery = MutableStateFlow("")
    val searchQuery = _searchQuery.asStateFlow()

    val maxMovieCount = immutablePreference.getMaxMovieCount().stateIn()
    val currentMovieCount = immutablePreference.getCurrentMovieCount().stateIn()

    val uiPreference = uiPreferenceDataStore.data.stateIn(UiPreference.Uncategorised)
    val moviePreference = moviePreferenceDataStore.data.stateIn(MoviePreference.Default)

    @OptIn(ExperimentalCoroutinesApi::class)
    val movies = searchQuery
        .debounce(1000L)
        .combine(moviePreferenceDataStore.data) { searchQuery, moviePreference ->
            moviesPagerUseCase.getMoviesPagingData(moviePreference, searchQuery)
        }.flatMapLatest {
            it
        }.cachedIn(viewModelScope)

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

    fun setUserInterface(ui: UserInterface?) {
        viewModelScope.launch(Dispatchers.IO) {
            uiPreferenceDataStore.updateData {
                it.copy(ui = ui ?: UiPreference.Uncategorised.ui)
            }
        }
    }

    fun clear() {
        viewModelScope.launch(Dispatchers.IO) {
            moviePreferenceDataStore.updateData {
                MoviePreference.Default
            }
            _searchQuery.value = ""
        }
    }

    fun getMovieGenreFlows(
        genres: List<Genre>,
    ): List<Flow<PagingData<Movie>>> {
        return genres.map {
            moviesPagerUseCase
                .getMoviesPagingData(MoviePreference.Default.copy(genre = it))
                .cachedIn(viewModelScope)
        }
    }
}