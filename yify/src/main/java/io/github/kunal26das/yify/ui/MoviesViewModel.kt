package io.github.kunal26das.yify.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import androidx.paging.cachedIn
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.source.factory.MoviesSourceFactory
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

@HiltViewModel
class MoviesViewModel @Inject constructor(
    private val moviesSourceFactory: MoviesSourceFactory,
) : ViewModel() {

    val movies: Flow<PagingData<Movie>>
        get() = Pager(
            config = PagingConfig(
                pageSize = LOAD_SIZE,
                initialLoadSize = LOAD_SIZE,
            ),
            pagingSourceFactory = moviesSourceFactory,
        ).flow.cachedIn(viewModelScope)

    companion object {
        const val LOAD_SIZE = 10
    }
}