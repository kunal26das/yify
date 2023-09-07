package io.github.kunal26das.yify.source

import io.github.kunal26das.common.paging.PagingSource
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.repo.MovieRepository
import io.github.kunal26das.yify.model.MoviePreference

class MoviesSource constructor(
    private val movieRepository: MovieRepository,
    private val moviePreference: MoviePreference,
) : PagingSource<Movie>() {
    override suspend fun load(
        params: LoadParams<Int>
    ): LoadResult<Int, Movie> {
        val page = params.key ?: 1
        val limit = params.loadSize
        val movies = moviePreference.run {
            movieRepository.getMovies(
                limit = limit,
                page = page,
                quality = quality,
                minimumRating = minimumRating,
                queryTerm = queryTerm,
                genre = genre,
                sortBy = sortBy,
                orderBy = orderBy,
                withRtRating = withRtRating,
            )
        }
        return LoadResult.Page(
            movies,
            if (page != 1) page - 1 else null,
            if (movies.isNotEmpty()) page + 1 else null,
        )
    }
}