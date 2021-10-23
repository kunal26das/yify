package io.github.kunal26das.yify.service

import io.github.kunal26das.yify.models.Response
import io.reactivex.Single
import retrofit2.http.GET
import retrofit2.http.Query

interface MovieService {

    @GET(ROUTE_LIST_MOVIES)
    suspend fun getMovies(
        @Query(QUERY_PAGE) page: Int,
        @Query(QUERY_LIMIT) limit: Int
    ): Response

//    @GET(API_MOVIE_DETAILS)
//    fun getMovie(@Query(QUERY_MOVIE_ID) movieId: Int): Single<MovieResponse>

    companion object {
        private const val ROUTE_LIST_MOVIES = "list_movies.json"
        private const val API_MOVIE_DETAILS = "movie_details.json"

        private const val QUERY_PAGE = "page"
        private const val QUERY_LIMIT = "limit"
        private const val QUERY_MOVIE_ID = "movie_id"
    }

}