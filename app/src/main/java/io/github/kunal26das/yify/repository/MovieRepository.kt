package io.github.kunal26das.yify.repository

import android.graphics.drawable.Drawable
import androidx.annotation.IntRange
import androidx.core.graphics.drawable.toBitmap
import androidx.palette.graphics.Palette
import io.github.kunal26das.yify.model.Movie
import io.github.kunal26das.yify.preference.Filters
import io.github.kunal26das.yify.preference.MutableMoviePreferences
import io.github.kunal26das.yify.service.MovieService
import javax.inject.Inject

class MovieRepository @Inject constructor(
    private val mutableMoviePreferences: MutableMoviePreferences?,
    private val movieService: MovieService,
) {

    suspend fun getMovies(
        @IntRange(from = 1, to = 50) page: Int,
        limit: Int, filters: Filters? = null,
    ): List<Movie>? {
        val response = movieService.getMovies(
            limit, page,
            filters?.quality,
            filters?.minimumRating,
            filters?.queryTerm,
            filters?.genre,
            filters?.sortBy,
            filters?.orderBy,
        )
        mutableMoviePreferences?.setMovieCount(response.data.movieCount)
        return response.data.movies
    }

    suspend fun getMovie(movieId: Int): Movie? {
        return movieService.getMovie(movieId).data.movie
    }

    suspend fun getMovieSuggestions(movieId: Int): List<Movie>? {
        return movieService.getMovieSuggestions(movieId).data.movies
    }

    fun generatePalette(drawable: Drawable): Palette {
        return Palette.from(drawable.toBitmap()).generate()
    }

}