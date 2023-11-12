package io.github.kunal26das.yify.usecase

import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import io.github.kunal26das.common.paging.IntPagingSource
import io.github.kunal26das.yify.Constants
import io.github.kunal26das.yify.source.MoviesPagingSource
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.MoviePreference
import io.github.kunal26das.yify.domain.repo.MovieRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class MoviesPagerUseCase @Inject constructor(
    private val movieRepository: MovieRepository,
) {

    fun getMoviesPagingData(moviePreference: MoviePreference): Flow<PagingData<Movie>> {
        return pager {
            MoviesPagingSource(movieRepository, moviePreference)
        }.flow
    }

    private fun pager(
        pagingSourceFactory: () -> IntPagingSource<Movie>,
    ) = Pager(
        config = PagingConfig(
            pageSize = Constants.LOAD_SIZE,
            initialLoadSize = Constants.MAX_LOAD_SIZE,
        ),
        initialKey = Constants.FIRST_PAGE,
        pagingSourceFactory = pagingSourceFactory,
    )
}