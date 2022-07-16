package io.github.kunal26das.yify.repository

import android.content.SharedPreferences
import android.graphics.drawable.Drawable
import androidx.annotation.IntRange
import androidx.core.graphics.drawable.toBitmap
import androidx.essentials.network.get
import androidx.essentials.network.set
import androidx.palette.graphics.Palette
import io.github.kunal26das.model.Cast
import io.github.kunal26das.model.Movie
import io.github.kunal26das.model.Preference
import io.github.kunal26das.model.Torrent
import io.github.kunal26das.yify.database.CastDao
import io.github.kunal26das.yify.database.MovieDao
import io.github.kunal26das.yify.database.TorrentDao
import io.github.kunal26das.yify.service.MovieService
import javax.inject.Inject

class MovieRepository @Inject constructor(
    private val sharedPreferences: SharedPreferences,
    private val movieService: MovieService,
    private val torrentDao: TorrentDao,
    private val movieDao: MovieDao,
    private val castDao: CastDao,
) : Repository {

    suspend fun getMovies(
        @IntRange(from = 1, to = 50) page: Int, limit: Int,
    ) = execute {
        sharedPreferences[Preference.page] = page
        val response = movieService.getMovies(
            limit, page,
            sharedPreferences[Preference.quality],
            sharedPreferences[Preference.minimum_rating],
            sharedPreferences[Preference.query_term],
            sharedPreferences[Preference.genre],
            sharedPreferences[Preference.sort_by],
            sharedPreferences[Preference.order_by],
        )
        sharedPreferences[Preference.movie_count] = response.data.movieCount
        val movies = response.data.movies
        insertMovies(movies)
        movies
    }

    suspend fun getMovie(movieId: Int) = execute {
        val movie = movieService.getMovie(movieId).data.movie
        insertMovie(movie)
        movie
    }

    suspend fun getMovieSuggestions(movieId: Int) = execute {
        val movies = movieService.getMovieSuggestions(movieId).data.movies
        insertMovies(movies)
        movies
    }

    private suspend fun insertMovie(
        movie: Movie?
    ) = execute {
        if (movie != null) {
            movieDao.insert(movie)
            insertCast(movie.cast)
            insertTorrents(movie.torrents)
        }
    }

    private suspend fun insertMovies(
        movies: List<Movie>?
    ) = execute {
        if (!movies.isNullOrEmpty()) {
            movieDao.insert(movies)
            movies.forEach {
                insertCast(it.cast)
                insertTorrents(it.torrents)
            }
        }
    }

    private suspend fun insertCast(
        cast: List<Cast>?
    ) = execute {
        if (!cast.isNullOrEmpty()) {
            castDao.insert(cast)
        }
    }

    private suspend fun insertTorrents(
        torrents: List<Torrent>?
    ) = execute {
        if (!torrents.isNullOrEmpty()) {
            torrentDao.insert(torrents)
        }
    }

    suspend fun generatePalette(drawable: Drawable) = execute {
        Palette.from(drawable.toBitmap()).generate()
    }

}