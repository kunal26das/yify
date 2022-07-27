package io.github.kunal26das.yify.source

import io.github.kunal26das.model.Movie
import io.github.kunal26das.yify.movie.filter.Filters
import io.github.kunal26das.yify.repository.MovieRepository

class NewMovies(
    movieRepository: MovieRepository,
    private val filters: Filters,
) : AllMovies(movieRepository, filters) {

    override suspend fun getMovies(page: Int, limit: Int): List<Movie>? {
        return super.getMovies(page, limit)?.filter {
            it.dateUploadedUnix!! > filters.addedBefore!!
        }
    }

}