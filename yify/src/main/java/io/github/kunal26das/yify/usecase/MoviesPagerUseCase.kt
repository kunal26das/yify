package io.github.kunal26das.yify.usecase

import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import androidx.paging.map
import io.github.kunal26das.common.connectivity.ConnectivityObserver
import io.github.kunal26das.common.model.ConnectionStatus
import io.github.kunal26das.yify.Constants
import io.github.kunal26das.yify.domain.mapper.toMovie
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.MoviePreference
import io.github.kunal26das.yify.domain.repo.MovieRepository
import io.github.kunal26das.yify.source.MoviesSource
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class MoviesPagerUseCase @Inject constructor(
    private val movieRepository: MovieRepository,
    private val connectivityObserver: ConnectivityObserver,
) {

    @OptIn(ExperimentalCoroutinesApi::class)
    fun getMoviesPagingData(
        moviePreference: MoviePreference,
        searchQuery: String? = null,
    ): Flow<PagingData<Movie>> {
        val preference = moviePreference.copy(queryTerm = searchQuery)
        return connectivityObserver.observe().flatMapLatest {
            when (it) {
                ConnectionStatus.Available -> {
                    remoteMoviesSourcePager(preference)
                }

                else -> localMoviesSourcePager(preference)
            }
        }
    }

    private fun remoteMoviesSourcePager(
        moviePreference: MoviePreference,
    ) = Pager(
        config = PagingConfig(
            pageSize = Constants.LOAD_SIZE,
            initialLoadSize = Constants.MAX_LOAD_SIZE,
        ),
        initialKey = Constants.FIRST_PAGE,
        pagingSourceFactory = {
            MoviesSource(movieRepository, moviePreference)
        },
    ).flow

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