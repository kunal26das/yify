package io.github.kunal26das.yify.service

import androidx.annotation.IntRange
import io.github.kunal26das.model.Genre
import io.github.kunal26das.model.Movie
import io.github.kunal26das.model.Quality
import io.github.kunal26das.model.Response
import retrofit2.http.GET
import retrofit2.http.Query

interface MovieService {

    @GET(ROUTE_MOVIES)
    suspend fun getMovies(
        @Query(KEY_LIMIT) limit: Int,

        @IntRange(from = 1, to = 50)
        @Query(KEY_PAGE) page: Int,

        @Quality
        @Query(KEY_QUALITY) quality: String? = null,

        @IntRange(from = 0, to = 9)
        @Query(KEY_MINIMUM_RATING) minimumRating: Int? = null,
        @Query(KEY_QUERY_TERM) queryTerm: String? = null,

        @Genre
        @Query(KEY_GENRE) genre: String? = null,
        @Query(KEY_SORT_BY) sortBy: String? = null,
        @Query(KEY_ORDER_BY) orderBy: String? = null,
        @Query(KEY_WITH_RT_RATINGS) withRtRating: Boolean? = null,
    ): Response

    @GET(ROUTE_MOVIE_SUGGESTIONS)
    suspend fun getMovieSuggestions(
        @Query(KEY_MOVIE_ID) movieId: Int
    ): Response

    @GET(ROUTE_MOVIE_DETAILS)
    suspend fun getMovie(
        @Query(KEY_MOVIE_ID) movieId: Int,
        @Query(KEY_WITH_IMAGES) withImages: Boolean = true,
        @Query(KEY_WITH_CAST) withCast: Boolean = true,
    ): Response

    @GET(ROUTE_UPCOMING_MOVIES)
    suspend fun getUpcomingMovies(): List<Movie>

    companion object {
        private const val ROUTE_MOVIES = "list_movies.json"
        private const val ROUTE_MOVIE_DETAILS = "movie_details.json"
        private const val ROUTE_UPCOMING_MOVIES = "list_upcoming.json"
        private const val ROUTE_MOVIE_SUGGESTIONS = "movie_suggestions.json"
        private const val ROUTE_MOVIE_PARENTAL_GUIDE = "movie_parental_guides.json"

        private const val KEY_PAGE = "page"
        private const val KEY_GENRE = "genre"
        private const val KEY_LIMIT = "limit"
        private const val KEY_QUALITY = "quality"
        private const val KEY_SORT_BY = "sort_by"
        private const val KEY_MOVIE_ID = "movie_id"
        private const val KEY_ORDER_BY = "order_by"
        private const val KEY_WITH_CAST = "with_cast"
        private const val KEY_QUERY_TERM = "query_term"
        private const val KEY_WITH_IMAGES = "with_images"
        private const val KEY_MINIMUM_RATING = "minimum_rating"
        private const val KEY_WITH_RT_RATINGS = "with_rt_ratings"
    }

}