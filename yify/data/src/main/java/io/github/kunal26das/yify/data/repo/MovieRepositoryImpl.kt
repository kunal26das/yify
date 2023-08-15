package io.github.kunal26das.yify.data.repo

import io.github.kunal26das.yify.data.mapper.toMovie
import io.github.kunal26das.yify.data.mapper.toMovies
import io.github.kunal26das.yify.data.service.MovieService
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.repo.MovieRepository
import javax.inject.Inject

class MovieRepositoryImpl @Inject constructor(
    private val movieService: MovieService,
) : MovieRepository {

    override suspend fun getMovies(
        limit: Int,
        page: Int,
        quality: String?,
        minimumRating: Int?,
        queryTerm: String?,
        genre: String?,
        sortBy: String?,
        orderBy: String?
    ): List<Movie> {
        return movieService.getMovies(
            limit = limit,
            page = page,
            quality = quality,
            minimumRating = minimumRating,
            queryTerm = queryTerm,
            genre = genre,
            sortBy = sortBy,
            orderBy = orderBy,
        ).data.movieModels.toMovies
    }

    override suspend fun getMovie(movieId: Int): Movie? {
        return movieService.getMovie(movieId).data.movieModel?.toMovie
    }

    override suspend fun getMovieSuggestions(movieId: Int): List<Movie> {
        return movieService.getMovieSuggestions(movieId).data.movieModels.toMovies
    }
}