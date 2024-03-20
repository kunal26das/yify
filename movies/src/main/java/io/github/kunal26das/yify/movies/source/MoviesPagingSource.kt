package io.github.kunal26das.yify.movies.source

import io.github.kunal26das.common.paging.IntPagingSource
import io.github.kunal26das.yify.movies.Constants
import io.github.kunal26das.yify.movies.domain.model.Movie
import io.github.kunal26das.yify.movies.domain.preference.MoviePreference
import io.github.kunal26das.yify.movies.domain.repo.MovieRepository

class MoviesPagingSource constructor(
    private val moviesRepository: MovieRepository,
    private val moviePreference: MoviePreference?,
) : IntPagingSource<Movie>() {
    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, Movie> {
        val page = params.key
        val limit = params.loadSize
        val result = moviesRepository.getMovies(
            limit = limit,
            page = page ?: Constants.FIRST_PAGE,
            moviePreference = moviePreference,
        )
        if (result.isSuccess) {
            val movies = result.getOrNull()
            return LoadResult.Page(
                data = movies.orEmpty(),
                prevKey = when (page) {
                    Constants.FIRST_PAGE -> null
                    else -> page?.minus(1)
                },
                nextKey = when {
                    movies.isNullOrEmpty() -> null
                    else -> page?.plus(1)
                }
            )
        } else {
            return LoadResult.Error(result.exceptionOrNull() ?: NullPointerException())
        }
    }

}