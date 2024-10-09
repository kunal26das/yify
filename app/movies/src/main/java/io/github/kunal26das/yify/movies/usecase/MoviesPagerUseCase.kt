package io.github.kunal26das.yify.movies.usecase

import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import androidx.paging.PagingSource
import io.github.kunal26das.yify.movies.Constants
import io.github.kunal26das.yify.movies.domain.model.Movie
import io.github.kunal26das.yify.movies.domain.preference.MoviePreference
import io.github.kunal26das.yify.movies.domain.repo.MovieRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class MoviesPagerUseCase @Inject constructor(
    private val movieRepository: MovieRepository,
) {
    fun getMoviesPagingData(
        moviePreference: MoviePreference,
        onFirstLoad: ((Long) -> Unit)? = null,
        onPagingSource: ((PagingSource<Int, Movie>) -> Unit)? = null,
    ): Flow<PagingData<Movie>> {
        return Pager(
            config = PagingConfig(
                enablePlaceholders = false,
                pageSize = Constants.LOAD_SIZE,
                initialLoadSize = Constants.LOAD_SIZE,
            ),
            initialKey = Constants.FIRST_PAGE,
            pagingSourceFactory = {
                movieRepository.getPagedMovies(moviePreference, onFirstLoad).also {
                    onPagingSource?.invoke(it)
                }
            },
        ).flow
    }
}