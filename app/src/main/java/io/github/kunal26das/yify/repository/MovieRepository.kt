package io.github.kunal26das.yify.repository

import android.content.Context
import androidx.annotation.IntRange
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.kunal26das.yify.YifyRetrofit
import io.github.kunal26das.yify.models.Movie
import io.github.kunal26das.yify.models.Movie.Companion.KEY_MOVIE
import io.github.kunal26das.yify.service.MovieDatabase
import io.github.kunal26das.yify.service.MovieService
import javax.inject.Inject

class MovieRepository @Inject constructor(
    @ApplicationContext context: Context
) : Repository(context) {

    private val movieDataStore by dataStore(KEY_MOVIE)
    private val movieDatabase by database<MovieDatabase>()
    private val movieRetrofit by retrofit<MovieService>(YifyRetrofit())

    suspend fun getMovies(
        @IntRange(from = 1, to = 50) page: Int,
        limit: Int,
    ): List<Movie> {
        return movieRetrofit.getMovies(
            page, limit,
            movieDataStore.get<String>(Preference.Quality),
            movieDataStore.get<Int>(Preference.MinimumRating),
            movieDataStore.get<String>(Preference.QueryTerm),
            movieDataStore.get<String>(Preference.SortBy),
            movieDataStore.get<String>(Preference.OrderBy),
//            dataStore.get<String>(Preference.Genre),
        ).data.movies.also {
            it.forEach { it.page = page }
            movieDatabase.movieDao.insert(it).enqueue()
        }
    }

    fun getMovieSuggestions(
        movie: Movie, onComplete: ((List<Movie>?) -> Unit)? = null
    ) {
        movieRetrofit.getMovieSuggestions(movie.id).map {
            it.data.movies
        }.enqueue {
            onComplete?.invoke(it)
            if (it != null) {
                movieDatabase.movieDao.insert(it)
            }
        }
    }

}