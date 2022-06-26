package io.github.kunal26das.yify.source

import io.github.kunal26das.model.Movie
import io.github.kunal26das.yify.repository.MovieRepository

class MoviePagingSource(
    private val movieRepository: MovieRepository,
    private val page: Int?,
) : PagingSource<Movie>() {

    override suspend fun load(
        params: LoadParams<Int>
    ): LoadResult<Int, Movie> {
        val limit = params.loadSize
        val page = params.key ?: page ?: 1
        val movies = movieRepository.getMovies(page, limit)
        return LoadResult.Page(
            movies ?: emptyList(),
            if (page == 1) null else page - 1,
            if (movies.isNullOrEmpty()) null else page + 1
        )
    }

}