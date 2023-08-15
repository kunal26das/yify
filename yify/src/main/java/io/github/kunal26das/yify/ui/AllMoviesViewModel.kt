package io.github.kunal26das.yify.ui

import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.yify.domain.repo.MovieRepository
import io.github.kunal26das.yify.source.AllMoviesSource
import javax.inject.Inject

@HiltViewModel
class AllMoviesViewModel @Inject constructor(
    private val movieRepository: MovieRepository,
) : MovieListViewModel() {

    init {
        refresh()
    }

    override suspend fun refreshInternal(delayTimeMillis: Long) {
        super.refresh(delayTimeMillis) {
            AllMoviesSource(movieRepository)
        }
    }

}