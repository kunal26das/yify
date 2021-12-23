package io.github.kunal26das.yify.repository

import android.content.Context
import androidx.annotation.IntRange
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.kunal26das.model.Movie
import io.github.kunal26das.model.Movie.Companion.KEY_MOVIE
import io.github.kunal26das.model.Preference
import io.github.kunal26das.network.local.database
import io.github.kunal26das.network.local.get
import io.github.kunal26das.network.singleton.Repository
import io.github.kunal26das.yify.database.MovieDatabase
import io.github.kunal26das.yify.network.MovieService
import io.github.kunal26das.yify.singleton.YifyRetrofit
import javax.inject.Inject

class MovieRepository @Inject constructor(
    @ApplicationContext context: Context
) : Repository(context) {

    private val preferences by sharedPreferences(KEY_MOVIE)
    private val retrofit by retrofit<MovieService>(YifyRetrofit(context))
    private val database by database<MovieDatabase>(applicationContext, KEY_MOVIE)

    suspend fun getMovies(
        @IntRange(from = 1, to = 50) page: Int,
        limit: Int,
    ): List<Movie> {
        return retrofit.getMovies(
            page, limit,
            preferences.get<String>(Preference.Quality),
            preferences.get<Int>(Preference.MinimumRating),
            preferences.get<String>(Preference.QueryTerm),
            preferences.get<String>(Preference.SortBy),
            preferences.get<String>(Preference.OrderBy),
//          preferences.get<String>(Preference.Genre),
        ).data.movies.also {
            it.forEach { it.page = page }
            database.dao.insert(it).enqueue()
        }
    }

    fun getMovieSuggestions(
        movie: Movie, onComplete: ((List<Movie>?) -> Unit)? = null
    ) {
        retrofit.getMovieSuggestions(movie.id).map {
            it.data.movies
        }.enqueue {
            onComplete?.invoke(it)
            if (it != null) {
                database.dao.insert(it)
            }
        }
    }

}