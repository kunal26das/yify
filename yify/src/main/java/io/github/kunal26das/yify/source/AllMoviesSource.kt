package io.github.kunal26das.yify.source

import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.repo.MovieRepository
import javax.inject.Inject

class AllMoviesSource @Inject constructor(
    private val movieRepository: MovieRepository,
) : MoviesSource() {
    override suspend fun getMovies(limit: Int, page: Int): List<Movie> {
        return movieRepository.getMovies(page, limit)
    }
}