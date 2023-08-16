package io.github.kunal26das.yify.source.factory

import io.github.kunal26das.common.PagingSourceFactory
import io.github.kunal26das.yify.domain.repo.MovieRepository
import io.github.kunal26das.yify.source.MoviesSource
import javax.inject.Inject

class MoviesSourceFactory @Inject constructor(
    private val movieRepository: MovieRepository
) : PagingSourceFactory<MoviesSource> {
    override fun invoke(): MoviesSource {
        return MoviesSource(movieRepository)
    }
}