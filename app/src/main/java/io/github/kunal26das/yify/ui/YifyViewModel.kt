package io.github.kunal26das.yify.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import androidx.paging.cachedIn
import io.github.kunal26das.yify.models.Movie
import io.github.kunal26das.yify.source.MovieDataSource
import kotlinx.coroutines.flow.Flow

class YifyViewModel : ViewModel() {

    val movies: Flow<PagingData<Movie>>
        get() = Pager(PagingConfig(10)) {
            MovieDataSource()
        }.flow.cachedIn(viewModelScope)

}