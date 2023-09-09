package io.github.kunal26das.yify.ui

import androidx.lifecycle.viewModelScope
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import androidx.paging.cachedIn
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.common.core.ViewModel
import io.github.kunal26das.yify.Constants
import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.OrderBy
import io.github.kunal26das.yify.domain.model.SortBy
import io.github.kunal26das.yify.model.MoviePreference
import io.github.kunal26das.yify.source.factory.MoviesSourceFactory
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

@HiltViewModel
class NetflixViewModel @Inject constructor(
    private val moviesSourceFactory: MoviesSourceFactory,
) : ViewModel() {

    fun getMovieGenreFlows(
        genres: List<Genre>,
    ): List<Flow<PagingData<Movie>>> {
        return genres.map {
            MoviePreference(
                genre = it,
                sortBy = SortBy.DateAdded,
                orderBy = OrderBy.Descending,
            )
        }.map {
            Pager(
                config = PagingConfig(
                    pageSize = Constants.LOAD_SIZE,
                    initialLoadSize = Constants.LOAD_SIZE,
                ),
                pagingSourceFactory = {
                    moviesSourceFactory.get(it)
                },
            ).flow.cachedIn(viewModelScope)
        }
    }

}