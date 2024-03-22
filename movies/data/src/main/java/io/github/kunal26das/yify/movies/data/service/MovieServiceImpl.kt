package io.github.kunal26das.yify.movies.data.service

import io.github.kunal26das.common.domain.logger.ExceptionLogger
import io.github.kunal26das.yify.movies.data.dto.ResponseDto
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.http.path
import javax.inject.Inject

class MovieServiceImpl @Inject constructor(
    private val httpClient: HttpClient,
    private val exceptionLogger: ExceptionLogger,
) : MovieService {
    override suspend fun getMovies(
        limit: Int,
        page: Int,
        quality: String?,
        minimumRating: Int?,
        queryTerm: String?,
        genre: String?,
        sortBy: String?,
        orderBy: String?
    ): Result<ResponseDto> {
        return exceptionLogger.runCatching {
            val response = httpClient.get {
                url {
                    path(MovieService.ROUTE_MOVIES)
                }
                parameter(MovieService.KEY_LIMIT, limit)
                parameter(MovieService.KEY_PAGE, page)
                if (quality.isNullOrEmpty().not()) {
                    parameter(MovieService.KEY_QUALITY, quality)
                }
                if (minimumRating != null) {
                    parameter(MovieService.KEY_MINIMUM_RATING, minimumRating)
                }
                if (queryTerm.isNullOrEmpty().not()) {
                    parameter(MovieService.KEY_QUERY_TERM, queryTerm)
                }
                if (genre.isNullOrEmpty().not()) {
                    parameter(MovieService.KEY_GENRE, genre)
                }
                if (sortBy.isNullOrEmpty().not()) {
                    parameter(MovieService.KEY_SORT_BY, sortBy)
                }
                if (orderBy.isNullOrEmpty().not()) {
                    parameter(MovieService.KEY_ORDER_BY, orderBy)
                }
            }
            response.body()
        }
    }

    override suspend fun getMovieSuggestions(movieId: Int): Result<ResponseDto> {
        return exceptionLogger.runCatching {
            val response = httpClient.get {
                url {
                    path(MovieService.ROUTE_MOVIE_SUGGESTIONS)
                }
                parameter(MovieService.KEY_MOVIE_ID, movieId)
            }
            response.body()
        }
    }

    override suspend fun getMovie(
        movieId: Int,
        withImages: Boolean,
        withCast: Boolean
    ): Result<ResponseDto> {
        return exceptionLogger.runCatching {
            val response = httpClient.get {
                url {
                    path(MovieService.ROUTE_MOVIE_DETAILS)
                }
                parameter(MovieService.KEY_MOVIE_ID, movieId)
                parameter(MovieService.KEY_WITH_IMAGES, withImages)
                parameter(MovieService.KEY_WITH_CAST, withCast)
            }
            response.body()
        }
    }
}