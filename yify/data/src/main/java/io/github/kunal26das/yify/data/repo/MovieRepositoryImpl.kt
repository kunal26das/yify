package io.github.kunal26das.yify.data.repo

import io.github.kunal26das.yify.data.mapper.toEntities
import io.github.kunal26das.yify.data.mapper.toEntity
import io.github.kunal26das.yify.data.mapper.toMovie
import io.github.kunal26das.yify.data.mapper.toMovies
import io.github.kunal26das.yify.data.service.MovieService
import io.github.kunal26das.yify.domain.db.MovieDao
import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.OrderBy
import io.github.kunal26das.yify.domain.model.Quality
import io.github.kunal26das.yify.domain.model.Rating
import io.github.kunal26das.yify.domain.model.SortBy
import io.github.kunal26das.yify.domain.repo.MovieRepository
import javax.inject.Inject

class MovieRepositoryImpl @Inject constructor(
    private val movieService: MovieService,
    private val movieDao: MovieDao,
) : MovieRepository {

    override suspend fun getMovies(
        limit: Int,
        page: Int,
        quality: Quality?,
        minimumRating: Rating?,
        queryTerm: String?,
        genre: Genre?,
        sortBy: SortBy?,
        orderBy: OrderBy?,
        withRtRating: Boolean?,
    ): List<Movie> {
        val result = movieService.getMovies(
            limit = limit,
            page = page,
            quality = quality?.value,
            minimumRating = minimumRating?.rating,
            queryTerm = queryTerm,
            genre = genre?.name,
            sortBy = sortBy?.value,
            orderBy = orderBy?.value,
            withRtRating = withRtRating,
        )
        if (result.isSuccess) {
            val movies = result.getOrNull()?.dataDto?.movies
            movieDao.upsert(movies.toEntities)
            return movies.toMovies
        } else {
            // make db call
        }
        return emptyList()
    }

    override suspend fun getMovie(movieId: Int): Movie? {
        val result = movieService.getMovie(movieId)
        if (result.isSuccess) {
            return result.getOrNull()?.dataDto?.movie?.let {
                movieDao.upsert(it.toEntity)
                it.toMovie
            }
        } else {
            // make db call
        }
        return null
    }
}