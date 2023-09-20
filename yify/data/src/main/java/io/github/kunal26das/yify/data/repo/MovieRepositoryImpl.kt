package io.github.kunal26das.yify.data.repo

import androidx.paging.PagingSource
import io.github.kunal26das.yify.data.mapper.GenreMapper
import io.github.kunal26das.yify.data.mapper.MovieMapper
import io.github.kunal26das.yify.data.mapper.key
import io.github.kunal26das.yify.data.service.MovieService
import io.github.kunal26das.yify.domain.db.MutablePreference
import io.github.kunal26das.yify.domain.db.YifyDatabase
import io.github.kunal26das.yify.domain.entity.MovieEntity
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.MoviePreference
import io.github.kunal26das.yify.domain.model.OrderBy
import io.github.kunal26das.yify.domain.model.SortBy
import io.github.kunal26das.yify.domain.repo.MovieRepository
import javax.inject.Inject

internal class MovieRepositoryImpl @Inject constructor(
    private val mutablePreference: MutablePreference,
    private val movieService: MovieService,
    private val yifyDatabase: YifyDatabase,
    private val movieMapper: MovieMapper,
    private val genreMapper: GenreMapper,
) : MovieRepository {

    override suspend fun getLocalMoviesCount(): Int {
        return yifyDatabase.movieDao.getMoviesCount()
    }

    override suspend fun getRemoteMoviesCount(): Result<Int?> {
        val result = movieService.getMovies(
            limit = 1,
            page = MovieService.FIRST_PAGE,
            sortBy = SortBy.DateAdded.key,
            orderBy = OrderBy.Descending.key,
        )
        return result.map {
            it.dataDto.movieCount
        }
    }

    override suspend fun getMovies(
        limit: Int,
        page: Int,
        moviePreference: MoviePreference?,
    ): Result<List<Movie>> {
        val result = movieService.getMovies(
            limit = limit,
            page = page,
            quality = moviePreference?.quality?.key,
            minimumRating = moviePreference?.minimumRating,
            queryTerm = moviePreference?.queryTerm,
            genre = moviePreference?.genre?.let {
                genreMapper.getKey(it)
            },
            sortBy = moviePreference?.sortBy?.key,
            orderBy = moviePreference?.orderBy?.key,
        )
        return result.map {
            movieMapper.toMovies(it.dataDto.movies)
        }
    }

    override suspend fun getMovieSuggestions(movieId: Int): Result<List<Movie>> {
        return movieService.getMovieSuggestions(movieId).map {
            movieMapper.toMovies(it.dataDto.movies)
        }
    }

    override fun getMoviesSource(
        moviePreference: MoviePreference?
    ): PagingSource<Int, MovieEntity> {
        return yifyDatabase.movieDao.getMovies(
            quality = moviePreference?.quality?.value,
            minimumRating = moviePreference?.minimumRating,
            queryTerm = moviePreference?.queryTerm,
            genre = moviePreference?.genre,
            sortBy = moviePreference?.sortBy?.name,
            orderBy = moviePreference?.orderBy?.name,
        )
    }
}