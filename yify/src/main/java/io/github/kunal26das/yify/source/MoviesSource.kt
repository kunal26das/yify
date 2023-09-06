package io.github.kunal26das.yify.source

import io.github.kunal26das.common.PagingSource
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.repo.MovieRepository
import io.github.kunal26das.yify.model.MoviePreference

class MoviesSource(
    private val movieRepository: MovieRepository,
    private val moviePreference: MoviePreference,
) : PagingSource<Movie>() {
    override suspend fun load(
        params: LoadParams<Int>
    ): LoadResult<Int, Movie> {
        val page = params.key ?: 1
        val limit = params.loadSize
        val movies = try {
            moviePreference.run {
                movieRepository.getMovies(
                    limit = limit,
                    page = page,
                    quality = quality?.name,
                    minimumRating = minimumRating,
                    queryTerm = queryTerm,
                    genre = genre?.name,
                    sortBy = sortBy?.name,
                    orderBy = orderBy?.name,
                    withRtRating = withRtRating,
                )
            }
        } catch (e: Throwable) {
            emptyList()
        }
        return LoadResult.Page(
            movies,
            if (page != 1) page - 1 else null,
            if (movies.isNotEmpty()) page + 1 else null,
        )
    }
}