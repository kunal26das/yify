package io.github.kunal26das.yify.repository

import io.github.kunal26das.yify.models.Response
import io.github.kunal26das.yify.service.MovieService

class MovieRepository : Repository() {

    private val movieService by service<MovieService>()

    fun getMovies(
        page: Int, onComplete: ((Response?) -> Unit)? = null
    ) {
        movieService.getMovies(PAGE_SIZE, page).enqueue(onComplete)
    }

    companion object {
        const val PAGE_SIZE = 10
    }

}