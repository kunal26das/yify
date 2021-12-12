package io.github.kunal26das.yify.network.remote

import androidx.annotation.IntRange
import io.github.kunal26das.yify.models.*
import io.reactivex.rxjava3.core.Single
import retrofit2.http.GET
import retrofit2.http.Query

interface MovieService {

    @GET(ROUTE_MOVIES)
    suspend fun getMovies(
        @IntRange(from = 1, to = 50)
        @Query(KEY_PAGE)
        page: Int,

        @Query(KEY_LIMIT)
        limit: Int,

        @Quality
        @Query(KEY_QUALITY)
        quality: String? = null,

        @IntRange(from = 0, to = 9)
        @Query(KEY_MINIMUM_RATING)
        minimumRating: Int? = null,

        @Query(KEY_QUERY_TERM)
        queryTerm: String? = null,

        @SortBy
        @Query(KEY_SORT_BY)
        sortBy: String? = null,

        @OrderBy
        @Query(KEY_ORDER_BY)
        orderBy: String? = null,

        @Genre
        @Query(KEY_GENRE)
        genre: String? = null,

        @Query(KEY_WITH_RT_RATINGS)
        withRtRating: Boolean? = null,
    ): Response

    @GET(ROUTE_UPCOMING_MOVIES)
    fun getUpcomingMovies(): Single<List<Movie>>

    @GET(ROUTE_MOVIE_SUGGESTIONS)
    fun getMovieSuggestions(
        @Query(KEY_MOVIE_ID) movieId: Int
    ): Single<Response>

    @GET(ROUTE_MOVIE_DETAILS)
    fun getMovie(
        @Query(KEY_MOVIE_ID) movieId: Int
    ): Single<Movie>

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
        private const val KEY_QUERY_TERM = "query_term"
        private const val KEY_MINIMUM_RATING = "minimum_rating"
        private const val KEY_WITH_RT_RATINGS = "with_rt_ratings"
    }

}