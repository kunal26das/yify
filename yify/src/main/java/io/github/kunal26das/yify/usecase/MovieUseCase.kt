package io.github.kunal26das.yify.usecase

import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.repo.MovieRepository
import javax.inject.Inject

class MovieUseCase @Inject constructor(
    private val movieRepository: MovieRepository,
) {
    suspend fun getMovie(movieId: Int): Result<Movie?> {
        return movieRepository.getLocalMovie(movieId)?.let {
            Result.success(it)
        } ?: movieRepository.getRemoteMovie(movieId)
    }
}