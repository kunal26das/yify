package io.github.kunal26das.yify.service

import io.github.kunal26das.yify.models.Response
import retrofit2.http.GET
import retrofit2.http.Query

interface MovieService {

    @GET(ROUTE_MOVIE_LIST)
    suspend fun getMovies(
        @Query(KEY_PAGE) page: Int,
        @Query(KEY_LIMIT) limit: Int
    ): Response

//    @GET(ROUTE_MOVIE_DETAILS)
//    fun getMovie(
//        @Query(KEY_MOVIE_ID) movieId: Int
//    ): Single<Movie>

    companion object {
        private const val ROUTE_MOVIE_LIST = "list_movies.json"
        private const val ROUTE_UPCOMING_LIST = "list_upcoming.json"
        private const val ROUTE_MOVIE_DETAILS = "movie_details.json"
        private const val ROUTE_MOVIE_SUGGESTIONS = "movie_suggestions.json"
        private const val ROUTE_MOVIE_PARENTAL_GUIDE = "movie_parental_guides.json"

        private const val KEY_PAGE = "page"
        private const val KEY_LIMIT = "limit"
        private const val KEY_MOVIE_ID = "movie_id"
    }

}