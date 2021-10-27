package io.github.kunal26das.yify.repository

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.kunal26das.yify.models.Movie
import io.github.kunal26das.yify.service.MovieService
import io.github.kunal26das.yify.service.YifyDatabase
import javax.inject.Inject

class MovieRepository @Inject constructor(
    @ApplicationContext context: Context
) : Repository(context) {

    private val movieService by service<MovieService>()
    private val yifyDatabase by database<YifyDatabase>()

    fun getUpcomingMovies(
        onComplete: ((List<Movie>?) -> Unit)? = null
    ) {
        movieService.getUpcomingMovies().enqueue(onComplete)
    }

    suspend fun getMovies(page: Int, limit: Int): List<Movie> {
        return movieService.getMovies(page, limit).data.movies.also {
            it.forEach { it.page = page }
            yifyDatabase.movieDao.insert(it).enqueue()
        }
    }

}