package io.github.kunal26das.yify.source

import androidx.paging.PagingSource
import androidx.paging.PagingState
import io.github.kunal26das.yify.models.Movie
import io.github.kunal26das.yify.repository.MovieRepository

class MovieDataSource : PagingSource<Int, Movie>() {

    private val movieRepository = MovieRepository()

    override fun getRefreshKey(state: PagingState<Int, Movie>): Int? {
        return state.anchorPosition?.let { anchorPosition ->
            state.closestPageToPosition(anchorPosition)?.prevKey?.plus(1)
                ?: state.closestPageToPosition(anchorPosition)?.nextKey?.minus(1)
        }
    }

    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, Movie> {
        return try {
            val response = movieRepository.getMovies(
                params.key ?: 1, params.loadSize
            )
            val page = response.data.pageNumber
            LoadResult.Page(
                response.data.movies,
                if (page == 1) null else page - 1,
                page + 1
            )
        } catch (e: Throwable) {
            LoadResult.Error(e)
        }
    }

}