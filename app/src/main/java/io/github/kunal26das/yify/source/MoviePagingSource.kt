package io.github.kunal26das.yify.source

import io.github.kunal26das.model.Movie
import io.github.kunal26das.yify.repository.MovieRepository

class MoviePagingSource(
    private val movieRepository: MovieRepository,
) : PagingSource<Movie>() {

    override suspend fun load(
        params: LoadParams<Int>
    ): LoadResult<Int, Movie> {
        val page = params.key ?: 1
        val limit = params.loadSize
        val movies = movieRepository.getMovies(page, limit)
        return LoadResult.Page(
            movies ?: emptyList(),
            if (page != 1) page - 1 else null,
            if (!movies.isNullOrEmpty()) page + 1 else null
        )
    }

}