package io.github.kunal26das.yify.repository

import android.content.Context
import androidx.annotation.IntRange
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.kunal26das.yify.models.Movie
import io.github.kunal26das.yify.service.MovieService
import io.github.kunal26das.yify.service.YifyDatabase
import javax.inject.Inject

class MovieRepository @Inject constructor(
    @ApplicationContext context: Context
) : Repository(context) {

    private val dataStore by dataStore()
    private val movieService by service<MovieService>()
    private val yifyDatabase by database<YifyDatabase>()

    suspend fun getMovies(
        @IntRange(from = 1, to = 50) page: Int,
        limit: Int,
    ): List<Movie> {
        return movieService.getMovies(
            page, limit,
            dataStore.get<String>(Preference.Quality),
            dataStore.get<Int>(Preference.MinimumRating),
            dataStore.get<String>(Preference.QueryTerm),
            dataStore.get<String>(Preference.SortBy),
            dataStore.get<String>(Preference.OrderBy),
//            dataStore.get<String>(Preference.Genre),
        ).data.movies.also {
            it.forEach { it.page = page }
            yifyDatabase.movieDao.insert(it).enqueue()
        }
    }

    fun getMovieSuggestions(
        movie: Movie, onComplete: ((List<Movie>?) -> Unit)? = null
    ) {
        movieService.getMovieSuggestions(movie.id).map {
            it.data.movies
        }.enqueue {
            onComplete?.invoke(it)
            if (it != null) {
                yifyDatabase.movieDao.insert(it)
            }
        }
    }

}