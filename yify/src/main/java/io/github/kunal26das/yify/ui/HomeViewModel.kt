package io.github.kunal26das.yify.ui

import androidx.datastore.core.DataStore
import androidx.lifecycle.viewModelScope
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.cachedIn
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.common.core.ViewModel
import io.github.kunal26das.yify.Constants
import io.github.kunal26das.yify.domain.db.FlowPreference
import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.OrderBy
import io.github.kunal26das.yify.domain.model.Quality
import io.github.kunal26das.yify.domain.model.SortBy
import io.github.kunal26das.yify.model.MoviePreference
import io.github.kunal26das.yify.source.factory.MoviesSourceFactory
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
class HomeViewModel @Inject constructor(
    private val moviesSourceFactory: MoviesSourceFactory,
    private val moviePreferenceDataStore: DataStore<MoviePreference>,
    immutablePreference: FlowPreference,
) : ViewModel() {

    private val _searchQuery = MutableStateFlow("")
    val searchQuery = _searchQuery.asStateFlow()

    val moviePreference = moviePreferenceDataStore.data.stateIn()

    val maxMovieCount = immutablePreference.getMaxMovieCount().stateIn()
    val currentMovieCount = immutablePreference.getCurrentMovieCount().stateIn()

    @OptIn(ExperimentalCoroutinesApi::class)
    val movies = searchQuery
        .debounce(1000L)
        .combine(moviePreferenceDataStore.data) { searchQuery, moviePreference ->
            Pager(
                config = PagingConfig(
                    pageSize = Constants.LOAD_SIZE,
                    initialLoadSize = Constants.LOAD_SIZE,
                ),
                pagingSourceFactory = {
                    moviesSourceFactory.get(moviePreference.copy(queryTerm = searchQuery))
                },
            )
        }.flatMapLatest {
            it.flow
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
                it.copy(quality = quality)
            }
        }
    }

    fun setSortBy(sortBy: SortBy?) {
        viewModelScope.launch(Dispatchers.IO) {
            moviePreferenceDataStore.updateData {
                it.copy(sortBy = sortBy)
            }
        }
    }

    fun setOrderBy(orderBy: OrderBy?) {
        viewModelScope.launch(Dispatchers.IO) {
            moviePreferenceDataStore.updateData {
                it.copy(orderBy = orderBy)
            }
        }
    }

    fun setMinimumRating(rating: Int?) {
        viewModelScope.launch(Dispatchers.IO) {
            moviePreferenceDataStore.updateData {
                it.copy(minimumRating = rating)
            }
        }
    }

    fun clear() {
        viewModelScope.launch(Dispatchers.IO) {
            moviePreferenceDataStore.updateData {
                MoviePreference()
            }
        }
    }
}