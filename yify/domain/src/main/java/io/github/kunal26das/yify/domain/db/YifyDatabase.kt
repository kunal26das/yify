package io.github.kunal26das.yify.domain.db

import io.github.kunal26das.yify.domain.model.Movie

interface YifyDatabase {
    val movieDao: MovieDao
    val torrentDao: TorrentDao
    suspend fun insertMovies(movies: List<Movie>)
    suspend fun getMovie(movieId: Int): Movie?
}