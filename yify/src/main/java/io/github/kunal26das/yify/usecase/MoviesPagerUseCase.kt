package io.github.kunal26das.yify.usecase

import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import androidx.paging.map
import io.github.kunal26das.yify.Constants
import io.github.kunal26das.yify.domain.mapper.toMovie
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.MoviePreference
import io.github.kunal26das.yify.domain.repo.MovieRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class MoviesPagerUseCase @Inject constructor(
    private val movieRepository: MovieRepository,
) {

    fun getMoviesPagingData(moviePreference: MoviePreference): Flow<PagingData<Movie>> {
        return localMoviesSourcePager(moviePreference)
    }

    private fun localMoviesSourcePager(
        moviePreference: MoviePreference,
    ) = Pager(
        config = PagingConfig(
            pageSize = Constants.LOAD_SIZE,
            initialLoadSize = Constants.LOAD_SIZE,
        ),
        initialKey = Constants.MAX_LOAD_SIZE,
        pagingSourceFactory = {
            movieRepository.getMoviesSource(moviePreference)
        },
    ).flow.map {
        it.map {
            it.toMovie()
        }
    }
}