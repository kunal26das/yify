package io.github.kunal26das.yify.movies.data.source

import androidx.paging.PagingSource
import androidx.paging.PagingState
import io.github.kunal26das.common.domain.logger.ExceptionLogger
import io.github.kunal26das.yify.movies.data.mapper.GenreMapper
import io.github.kunal26das.yify.movies.data.mapper.MovieMapper
import io.github.kunal26das.yify.movies.data.mapper.key
import io.github.kunal26das.yify.movies.data.service.MovieService
import io.github.kunal26das.yify.movies.domain.model.Movie
import io.github.kunal26das.yify.movies.domain.preference.MoviePreference

internal class MoviesPagingSource(
    private val movieService: MovieService,
    private val movieMapper: MovieMapper,
    private val genreMapper: GenreMapper,
    private val exceptionLogger: ExceptionLogger,
    private val moviePreference: MoviePreference?,
) : PagingSource<Int, Movie>() {
    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, Movie> {
        val page = params.key ?: return LoadResult.Page(emptyList(), null, null)
        val limit = params.loadSize
        return try {
            val result = movieService.getMovies(
                limit = limit,
                page = page,
                quality = moviePreference?.quality?.key,
                minimumRating = moviePreference?.minimumRating,
                queryTerm = moviePreference?.queryTerm,
                genre = moviePreference?.genre?.let {
                    genreMapper.getKey(it)
                },
                sortBy = moviePreference?.sortBy?.key,
                orderBy = moviePreference?.orderBy?.key,
            )
            if (result.isFailure) {
                throw result.exceptionOrNull()!!
            }
            val movies = result.map {
                movieMapper.toMovies(it.dataDto?.movies)
            }.getOrNull().orEmpty()
            LoadResult.Page(
                data = movies,
                prevKey = when (page) {
                    1 -> null
                    else -> page.minus(1)
                },
                nextKey = when {
                    movies.isEmpty() -> null
                    else -> page.plus(1)
                }
            )
        } catch (e: Exception) {
            exceptionLogger.log(e)
            LoadResult.Error(e)
        }
    }

    override fun getRefreshKey(state: PagingState<Int, Movie>): Int? {
        return state.anchorPosition?.let { anchorPosition ->
            state.closestPageToPosition(anchorPosition)?.prevKey?.plus(1)
                ?: state.closestPageToPosition(anchorPosition)?.nextKey?.minus(1)
        }
    }
}