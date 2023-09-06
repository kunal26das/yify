package io.github.kunal26das.yify.source.factory

import io.github.kunal26das.yify.domain.repo.MovieRepository
import io.github.kunal26das.yify.model.MoviePreference
import io.github.kunal26das.yify.source.MoviesSource
import javax.inject.Inject

class MoviesSourceFactory @Inject constructor(
    private val movieRepository: MovieRepository,
) {
    fun get(
        moviePreference: MoviePreference,
    ): MoviesSource {
        return MoviesSource(
            movieRepository = movieRepository,
            moviePreference = moviePreference,
        )
    }
}