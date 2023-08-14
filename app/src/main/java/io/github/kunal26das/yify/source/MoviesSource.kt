package io.github.kunal26das.yify.source

import com.google.firebase.crashlytics.ktx.crashlytics
import com.google.firebase.ktx.Firebase
import io.github.kunal26das.yify.model.Movie

abstract class MoviesSource : PagingSource<Movie>() {

    override suspend fun load(
        params: LoadParams<Int>
    ): LoadResult<Int, Movie> {
        val page = params.key ?: 1
        val limit = params.loadSize
        val movies = try {
            getMovies(page, limit)
        } catch (e: Throwable) {
            Firebase.crashlytics.recordException(e)
            null
        }
        return LoadResult.Page(
            movies ?: emptyList(),
            if (page != 1) page - 1 else null,
            if (!movies.isNullOrEmpty()) page + 1 else null
        )
    }

    protected abstract suspend fun getMovies(page: Int, limit: Int): List<Movie>?

}