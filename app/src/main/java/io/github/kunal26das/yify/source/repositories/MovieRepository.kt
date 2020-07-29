package io.github.kunal26das.yify.source.repositories

import androidx.essentials.core.KoinComponent.inject
import io.github.kunal26das.yify.source.services.MovieService
import io.github.kunal26das.yify.utils.Constants.PAGE_SIZE
import retrofit2.Retrofit

class MovieRepository {

    private val retrofit: Retrofit by inject()
    private val movieService = retrofit.create(MovieService::class.java)

    fun getMovies(page: Int) = movieService.getMovies(PAGE_SIZE, page)
//    fun getMovie(movieId: Int) = movieService.getMovie(movieId)
}