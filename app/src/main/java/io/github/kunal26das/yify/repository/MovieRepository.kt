package io.github.kunal26das.yify.repository

import androidx.annotation.IntRange
import com.google.firebase.crashlytics.ktx.crashlytics
import com.google.firebase.ktx.Firebase
import io.github.kunal26das.model.Movie
import io.github.kunal26das.model.Preference
import io.github.kunal26das.yify.database.MovieDatabaseBuilder
import io.github.kunal26das.yify.preference.MoviePreferences
import io.github.kunal26das.yify.service.MovieService
import javax.inject.Inject

class MovieRepository @Inject constructor(
    private val moviePreferences: MoviePreferences,
    private val movieDatabase: MovieDatabaseBuilder,
    private val movieService: MovieService,
) {

    suspend fun getMovies(
        @IntRange(from = 1, to = 50) page: Int, limit: Int,
    ) = execute {
        val movies = movieService.getMovies(
            page, limit,
            moviePreferences[Preference.quality],
            moviePreferences[Preference.minimum_rating],
            moviePreferences[Preference.query_term],
            moviePreferences[Preference.sort_by],
            moviePreferences[Preference.order_by],
//            preferences[Preference.Genre],
        ).data.movies
        movieDatabase.getInstance().dao.insert(movies)
        movies.forEach { it.page = page }
        movies
    }

    suspend fun getMovieSuggestions(movie: Movie) = execute {
        val movies = movieService.getMovieSuggestions(movie.id).data.movies
        movieDatabase.getInstance().dao.insert(movies)
        movies
    }

    private suspend fun <T> execute(
        block: suspend () -> T
    ) = try {
        block.invoke()
    } catch (e: Throwable) {
        Firebase.crashlytics.recordException(e)
        null
    }

}