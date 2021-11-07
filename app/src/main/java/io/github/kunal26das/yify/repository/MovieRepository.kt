package io.github.kunal26das.yify.repository

import android.content.Context
import androidx.annotation.IntRange
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.kunal26das.yify.models.Movie
import io.github.kunal26das.yify.models.Quality
import io.github.kunal26das.yify.service.MovieService
import io.github.kunal26das.yify.service.YifyDatabase
import javax.inject.Inject

class MovieRepository @Inject constructor(
    @ApplicationContext context: Context
) : Repository(context) {

    private val movieService by service<MovieService>()
    private val yifyDatabase by database<YifyDatabase>()

    suspend fun getMovies(
        @IntRange(from = 1, to = 50) page: Int,
        limit: Int,
        @Quality quality: String? = null,
    ): List<Movie> {
        return movieService.getMovies(page, limit, quality).data.movies.also {
            it.forEach { it.page = page }
            yifyDatabase.movieDao.insert(it).enqueue()
        }
    }

}