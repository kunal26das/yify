package io.github.kunal26das.yify.repository

import androidx.annotation.IntRange
import androidx.essentials.network.local.Preferences
import com.google.firebase.crashlytics.ktx.crashlytics
import com.google.firebase.ktx.Firebase
import io.github.kunal26das.model.Movie
import io.github.kunal26das.model.Preference
import io.github.kunal26das.yify.database.MovieDatabaseBuilder
import io.github.kunal26das.yify.service.MovieService
import javax.inject.Inject

class MovieRepository @Inject constructor(
    private val movieDatabase: MovieDatabaseBuilder,
    private val movieService: MovieService,
    private val preferences: Preferences,
) {

    suspend fun getMovies(
        @IntRange(from = 1, to = 50) page: Int, limit: Int,
    ) = execute {
        val response = movieService.getMovies(
            limit, page,
            preferences[Preference.quality],
            preferences[Preference.minimum_rating],
            preferences[Preference.query_term],
            preferences[Preference.genre],
            preferences[Preference.sort_by],
            preferences[Preference.order_by],
        )
        val movies = response.data.movies
        preferences[Preference.movie_count] = response.data.movieCount
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