package io.github.kunal26das.yify.source

import androidx.paging.DataSource
import androidx.paging.PageKeyedDataSource
import io.github.kunal26das.yify.models.Movie
import io.github.kunal26das.yify.repository.MovieRepository
import java.io.Closeable

class YifyDataSource : PageKeyedDataSource<Int, Movie>() {

    internal val movieRepository = MovieRepository()

    override fun loadInitial(
        params: LoadInitialParams<Int>,
        callback: LoadInitialCallback<Int, Movie>
    ) {
        val page = 1
        movieRepository.getMovies(page) {
            val movies = it?.data?.movies ?: emptyList()
            callback.onResult(movies, null, page)
        }
    }

    override fun loadAfter(params: LoadParams<Int>, callback: LoadCallback<Int, Movie>) {
        val page = params.key + 1
        movieRepository.getMovies(page) {
            val movies = it?.data?.movies ?: emptyList()
            callback.onResult(movies, page)
        }
    }

    override fun loadBefore(params: LoadParams<Int>, callback: LoadCallback<Int, Movie>) {
        val page = params.key - 1
        movieRepository.getMovies(page) {
            val movies = it?.data?.movies ?: emptyList()
            callback.onResult(movies, page)
        }
    }

    companion object : DataSource.Factory<Int, Movie>(), Closeable {
        private val dataSource = YifyDataSource()
        override fun create() = dataSource
        override fun close() = dataSource.movieRepository.close()
    }

}