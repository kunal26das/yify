package io.github.kunal26das.yify.repository

import io.github.kunal26das.yify.models.Response
import io.github.kunal26das.yify.service.MovieService
import io.reactivex.Single

class MovieRepository : Repository() {

    private val movieService by service<MovieService>()

    suspend fun getMovies(
        page: Int, limit: Int,
    ): Response {
        return movieService.getMovies(page, limit)
    }

}