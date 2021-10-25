package io.github.kunal26das.yify.repository

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.kunal26das.yify.models.Response
import io.github.kunal26das.yify.service.MovieService
import io.github.kunal26das.yify.service.YifyDatabase
import javax.inject.Inject

class MovieRepository @Inject constructor(
    @ApplicationContext context: Context
) : Repository(context) {

    private val movieService by service<MovieService>()
    private val yifyDatabase by database<YifyDatabase>()

    suspend fun getMovies(
        page: Int, limit: Int,
    ): Response {
        return movieService.getMovies(page, limit).also {
            yifyDatabase.movieDao.insertAll(it.data.movies).enqueue()
        }
    }

}