package io.github.kunal26das.yify.source.services

import io.github.kunal26das.yify.source.models.Response
import io.reactivex.Single
import retrofit2.http.GET
import retrofit2.http.Query

interface MovieService {

    @GET(API_LIST_MOVIES)
    fun getMovies(
        @Query(QUERY_LIMIT) limit: Int,
        @Query(QUERY_PAGE) page: Int
    ): Single<Response>

//    @GET(API_MOVIE_DETAILS)
//    fun getMovie(@Query(QUERY_MOVIE_ID) movieId: Int): Single<MovieResponse>

    companion object {
        private const val API_LIST_MOVIES = "list_movies.json"
        private const val API_MOVIE_DETAILS = "movie_details.json"

        private const val QUERY_PAGE = "page"
        private const val QUERY_LIMIT = "limit"
        private const val QUERY_MOVIE_ID = "movie_id"
    }

}