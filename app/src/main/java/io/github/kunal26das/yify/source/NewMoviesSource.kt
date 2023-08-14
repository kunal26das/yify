package io.github.kunal26das.yify.source

import io.github.kunal26das.yify.model.Movie
import io.github.kunal26das.yify.preference.Filters
import io.github.kunal26das.yify.repository.MovieRepository

class NewMoviesSource constructor(
    private val movieRepository: MovieRepository,
    private val filters: Filters,
) : MoviesSource() {
    override suspend fun getMovies(page: Int, limit: Int): List<Movie>? {
        return movieRepository.getMovies(page, limit, filters)?.filter {
            it.dateUploadedUnix!! > filters.addedBefore!!
        }
    }
}