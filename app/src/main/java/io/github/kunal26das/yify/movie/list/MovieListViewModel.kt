package io.github.kunal26das.yify.movie.list

import androidx.essentials.network.local.Preferences
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import androidx.paging.cachedIn
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.model.Movie
import io.github.kunal26das.model.Preference
import io.github.kunal26das.yify.repository.MovieRepository
import io.github.kunal26das.yify.source.MoviePagingSource
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MovieListViewModel @Inject constructor(
    private val movieRepository: MovieRepository,
    preferences: Preferences,
) : ViewModel() {

    private var filter: Job? = null
    val movies = MutableLiveData<Flow<PagingData<Movie>>>()
    val page by preferences.mutableLiveDataOf<Int>(Preference.page)
    val columns by preferences.mutableLiveDataOf<Int>(Preference.columns)
    val loading by preferences.mutableLiveDataOf<Boolean>(Preference.loading)
    val movieCount by preferences.mutableLiveDataOf<Int>(Preference.movie_count)

    init {
        refresh()
    }

    fun refresh() {
        filter?.cancel()
        loading.value = true
        filter = viewModelScope.launch {
            delay(1000L)
            movies.postValue(Pager(PagingConfig(10)) {
                MoviePagingSource(movieRepository, page.value)
            }.flow.cachedIn(viewModelScope))
        }
    }

}