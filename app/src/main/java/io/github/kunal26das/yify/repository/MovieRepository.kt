package io.github.kunal26das.yify.repository

import android.content.SharedPreferences
import androidx.annotation.IntRange
import androidx.essentials.network.get
import androidx.essentials.network.set
import com.google.firebase.crashlytics.ktx.crashlytics
import com.google.firebase.ktx.Firebase
import io.github.kunal26das.model.Movie
import io.github.kunal26das.model.Preference
import io.github.kunal26das.yify.database.MovieDatabaseBuilder
import io.github.kunal26das.yify.service.MovieService
import javax.inject.Inject

class MovieRepository @Inject constructor(
    private val sharedPreferences: SharedPreferences,
    private val movieDatabase: MovieDatabaseBuilder,
    private val movieService: MovieService,
) {

    suspend fun getMovies(
        @IntRange(from = 1, to = 50) page: Int, limit: Int,
    ) = execute {
        val response = movieService.getMovies(
            limit, page,
            sharedPreferences[Preference.quality],
            sharedPreferences[Preference.minimum_rating],
            sharedPreferences[Preference.query_term],
            sharedPreferences[Preference.genre],
            sharedPreferences[Preference.sort_by],
            sharedPreferences[Preference.order_by],
        )
        val movies = response.data.movies
        sharedPreferences[Preference.page] = page
        sharedPreferences[Preference.movie_count] = response.data.movieCount
        if (movies != null) movieDatabase.INSTANCE.dao.insert(movies)
        movies?.forEach { it.page = page }
        movies
    }

    suspend fun getMovie(movieId: Int) = execute {
        val movie = movieService.getMovie(movieId).data.movie
        if (movie != null) movieDatabase.INSTANCE.dao.insert(movie)
        movie
    }

    suspend fun getMovieSuggestions(movie: Movie) = execute {
        val movies = movieService.getMovieSuggestions(movie.id).data.movies
        if (movies != null) movieDatabase.INSTANCE.dao.insert(movies)
        movies
    }

    private suspend fun <T> execute(
        block: suspend () -> T
    ) = try {
        val response = block.invoke()
        sharedPreferences[Preference.loading] = false
        response
    } catch (e: Throwable) {
        Firebase.crashlytics.recordException(e)
        null
    }

}