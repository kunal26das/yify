package io.github.kunal26das.yify.movie.list

import android.content.SharedPreferences
import androidx.essentials.network.mutableLiveDataOf
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
    sharedPreferences: SharedPreferences,
) : ViewModel() {

    private var filter: Job? = null
    val movies = MutableLiveData<Flow<PagingData<Movie>>>()
    val page by sharedPreferences.mutableLiveDataOf<Int>(Preference.page)
    val columns by sharedPreferences.mutableLiveDataOf<Int>(Preference.columns)
    val movieCount by sharedPreferences.mutableLiveDataOf<Int>(Preference.movie_count)

    init {
        refresh()
    }

    fun refresh(delayTimeMillis: Long = 0L) {
        filter?.cancel()
        filter = viewModelScope.launch {
            delay(delayTimeMillis)
            movies.postValue(
                Pager(
                    PagingConfig(
                        initialLoadSize = LOAD_SIZE,
                        pageSize = LOAD_SIZE,
                    )
                ) {
                    MoviePagingSource(movieRepository)
                }.flow.cachedIn(viewModelScope)
            )
        }
    }

    companion object {
        private const val LOAD_SIZE = 10
    }

}