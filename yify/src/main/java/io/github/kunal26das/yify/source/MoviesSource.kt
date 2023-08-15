package io.github.kunal26das.yify.source

import io.github.kunal26das.common.PagingSource
import io.github.kunal26das.yify.domain.model.Movie

abstract class MoviesSource : PagingSource<Movie>() {
    override suspend fun load(
        params: LoadParams<Int>
    ): LoadResult<Int, Movie> {
        val page = params.key ?: 1
        val limit = params.loadSize
        val movies = getMovies(limit, page)
        return LoadResult.Page(
            movies,
            if (page != 1) page - 1 else null,
            if (movies.isNotEmpty()) page + 1 else null
        )
    }

    protected abstract suspend fun getMovies(limit: Int, page: Int): List<Movie>
}