package io.github.kunal26das.yify.movies.data.service

import io.github.kunal26das.yify.movies.data.dto.ResponseDto

interface MovieService {

    suspend fun getMovies(
        limit: Int,
        page: Int = FIRST_PAGE,
        quality: String? = null,
        minimumRating: Int? = null,
        queryTerm: String? = null,
        genre: String? = null,
        sortBy: String? = null,
        orderBy: String? = null,
    ): Result<ResponseDto>

    suspend fun getMovieSuggestions(
        movieId: Int
    ): Result<ResponseDto>

    suspend fun getMovie(
        movieId: Int,
        withImages: Boolean = true,
        withCast: Boolean = true,
    ): Result<ResponseDto>

    companion object {
        const val FIRST_PAGE = 1

        internal const val KEY_PAGE = "page"
        internal const val KEY_GENRE = "genre"
        internal const val KEY_LIMIT = "limit"
        internal const val KEY_QUALITY = "quality"
        internal const val KEY_SORT_BY = "sort_by"
        internal const val KEY_MOVIE_ID = "movie_id"
        internal const val KEY_ORDER_BY = "order_by"
        internal const val KEY_WITH_CAST = "with_cast"
        internal const val KEY_QUERY_TERM = "query_term"
        internal const val KEY_WITH_IMAGES = "with_images"
        internal const val KEY_MINIMUM_RATING = "minimum_rating"

        internal const val ROUTE_MOVIES = "list_movies.json"
        internal const val ROUTE_MOVIE_DETAILS = "movie_details.json"
        internal const val ROUTE_MOVIE_SUGGESTIONS = "movie_suggestions.json"
    }
}