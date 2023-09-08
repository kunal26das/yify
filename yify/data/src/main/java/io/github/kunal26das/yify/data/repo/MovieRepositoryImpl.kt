package io.github.kunal26das.yify.data.repo

import io.github.kunal26das.yify.data.mapper.key
import io.github.kunal26das.yify.data.mapper.toEntities
import io.github.kunal26das.yify.data.mapper.toEntity
import io.github.kunal26das.yify.data.mapper.toMovie
import io.github.kunal26das.yify.data.mapper.toMovies
import io.github.kunal26das.yify.data.service.MovieService
import io.github.kunal26das.yify.domain.db.ImmutablePreference
import io.github.kunal26das.yify.domain.db.MovieDao
import io.github.kunal26das.yify.domain.db.MutablePreference
import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.OrderBy
import io.github.kunal26das.yify.domain.model.Quality
import io.github.kunal26das.yify.domain.model.SortBy
import io.github.kunal26das.yify.domain.repo.MovieRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.max

class MovieRepositoryImpl @Inject constructor(
    private val immutablePreference: ImmutablePreference,
    private val mutablePreference: MutablePreference,
    private val movieService: MovieService,
    private val movieDao: MovieDao,
) : MovieRepository {

    override suspend fun getMovies(
        limit: Int,
        page: Int,
        quality: Quality?,
        minimumRating: Int?,
        queryTerm: String?,
        genre: Genre?,
        sortBy: SortBy?,
        orderBy: OrderBy?,
        withRtRating: Boolean?,
    ): List<Movie> {
        val result = movieService.getMovies(
            limit = limit,
            page = page,
            quality = quality?.key,
            minimumRating = minimumRating,
            queryTerm = queryTerm,
            genre = genre?.key,
            sortBy = sortBy?.key,
            orderBy = orderBy?.key,
            withRtRating = withRtRating,
        )
        return if (result.isSuccess) {
            val data = result.getOrNull()?.dataDto
            data?.movieCount?.let {
                updateMovieCount(it)
            }
            val movies = data?.movies
            movieDao.upsert(movies.toEntities)
            movies.toMovies
        } else {
            emptyList()
        }
    }

    private fun updateMovieCount(movieCount: Int) {
        CoroutineScope(Dispatchers.IO).launch {
            val max = max(movieCount, immutablePreference.getMaxMovieCount() ?: 0)
            mutablePreference.setCurrentMovieCount(movieCount)
            mutablePreference.setMaxMovieCount(max)
        }
    }

    override suspend fun getMovie(movieId: Int): Movie? {
        val result = movieService.getMovie(movieId)
        return if (result.isSuccess) {
            result.getOrNull()?.dataDto?.movie?.let {
                movieDao.upsert(it.toEntity)
                it.toMovie
            }
        } else {
            movieDao.get(movieId)?.toMovie
        }
    }
}