package io.github.kunal26das.yify.ui

import androidx.paging.PagingSource
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.yify.repository.MovieRepository
import javax.inject.Inject

@HiltViewModel
class YifyViewModel @Inject constructor(
    movieRepository: MovieRepository
) : ViewModel() {

    val movies by flow {
        try {
            val response = movieRepository.getMovies(it.key ?: 1, it.loadSize)
            val page = response.data.pageNumber
            PagingSource.LoadResult.Page(
                response.data.movies,
                if (page == 1) null else page - 1,
                page + 1
            )
        } catch (e: Throwable) {
            PagingSource.LoadResult.Error(e)
        }
    }

}