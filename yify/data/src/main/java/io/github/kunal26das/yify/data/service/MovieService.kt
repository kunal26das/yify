package io.github.kunal26das.yify.data.service

import io.github.kunal26das.yify.data.model.MovieModel
import io.github.kunal26das.yify.data.model.Response
import retrofit2.http.GET
import retrofit2.http.Query

interface MovieService {

    @GET(ROUTE_MOVIES)
    suspend fun getMovies(
        @Query(KEY_LIMIT) limit: Int,
        @Query(KEY_PAGE) page: Int,
        @Query(KEY_QUALITY) quality: String? = null,
        @Query(KEY_MINIMUM_RATING) minimumRating: Int? = null,
        @Query(KEY_QUERY_TERM) queryTerm: String? = null,
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
    suspend fun getUpcomingMovies(): List<MovieModel>

    companion object {
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

        private const val ROUTE_MOVIES = "list_movies.json"
        private const val ROUTE_MOVIE_DETAILS = "movie_details.json"
        private const val ROUTE_UPCOMING_MOVIES = "list_upcoming.json"
        private const val ROUTE_MOVIE_SUGGESTIONS = "movie_suggestions.json"
        private const val ROUTE_MOVIE_PARENTAL_GUIDE = "movie_parental_guides.json"
    }
}