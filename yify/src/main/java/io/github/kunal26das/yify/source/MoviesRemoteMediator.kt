package io.github.kunal26das.yify.source

import androidx.paging.ExperimentalPagingApi
import androidx.paging.LoadType
import androidx.paging.PagingState
import androidx.paging.RemoteMediator
import io.github.kunal26das.common.paging.RefreshKey
import io.github.kunal26das.common.paging.RefreshKeyImpl
import io.github.kunal26das.yify.Constants
import io.github.kunal26das.yify.domain.entity.MovieEntity
import io.github.kunal26das.yify.domain.model.MoviePreference
import io.github.kunal26das.yify.domain.repo.MovieRepository

@OptIn(ExperimentalPagingApi::class)
class MoviesRemoteMediator constructor(
    private val movieRepository: MovieRepository,
    private val moviePreference: MoviePreference?,
) : RemoteMediator<Int, MovieEntity>(), RefreshKey by RefreshKeyImpl() {

    override suspend fun load(
        loadType: LoadType,
        state: PagingState<Int, MovieEntity>
    ): MediatorResult {
        val result = movieRepository.getMovies(
            page = refreshKey(state) ?: Constants.FIRST_PAGE,
            limit = state.config.pageSize,
            moviePreference = moviePreference,
        )
        return if (result.isSuccess) {
            val movies = result.getOrNull().orEmpty()
            MediatorResult.Success(movies.isEmpty())
        } else try {
            MediatorResult.Error(result.exceptionOrNull()!!)
        } catch (e: NullPointerException) {
            MediatorResult.Error(e)
        }
    }
}