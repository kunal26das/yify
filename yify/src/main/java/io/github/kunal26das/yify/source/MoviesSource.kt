package io.github.kunal26das.yify.source

import androidx.paging.PagingSource
import androidx.paging.PagingState
import io.github.kunal26das.common.paging.RefreshKey
import io.github.kunal26das.common.paging.RefreshKeyImpl
import io.github.kunal26das.yify.Constants
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.MoviePreference
import io.github.kunal26das.yify.domain.repo.MovieRepository

class MoviesSource constructor(
    private val movieRepository: MovieRepository,
    private val moviePreference: MoviePreference,
) : PagingSource<Int, Movie>(), RefreshKey by RefreshKeyImpl() {

    override suspend fun load(
        params: LoadParams<Int>
    ): LoadResult<Int, Movie> {
        val page = params.key ?: Constants.FIRST_PAGE
        val movies = movieRepository.getMovies(
            limit = params.loadSize,
            page = page,
            moviePreference = moviePreference,
        ).getOrNull().orEmpty()
        return LoadResult.Page(
            movies,
            if (page != 1) page - 1 else null,
            if (movies.isNotEmpty()) page + 1 else null,
        )
    }

    override fun getRefreshKey(state: PagingState<Int, Movie>): Int? {
        return refreshKey(state)
    }
}