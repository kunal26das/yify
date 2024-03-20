package io.github.kunal26das.yify.movies.usecase

import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
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
        moviePreference: MoviePreference?
    ): Flow<PagingData<Movie>> {
        return Pager(
            config = PagingConfig(
                enablePlaceholders = false,
                pageSize = Constants.LOAD_SIZE,
                initialLoadSize = Constants.MAX_LOAD_SIZE,
            ),
            initialKey = Constants.FIRST_PAGE,
            pagingSourceFactory = {
                movieRepository.getPagedMovies(moviePreference)
            },
        ).flow
    }
}