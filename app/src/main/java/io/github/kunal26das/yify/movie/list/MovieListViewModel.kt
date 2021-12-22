package io.github.kunal26das.yify.movie.list

import androidx.lifecycle.MutableLiveData
import androidx.paging.PagingSource
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.core.ViewModel
import io.github.kunal26das.yify.repository.MovieRepository
import javax.inject.Inject

@HiltViewModel
class MovieListViewModel @Inject constructor(
    private val movieRepository: MovieRepository,
) : ViewModel() {

    val page = MutableLiveData<Int>()

    val movies by flow(20) {
        try {
            val page = it.key ?: 1
            val limit = it.loadSize
            this.page.postValue(page)
            val movies = movieRepository.getMovies(page, limit)
            PagingSource.LoadResult.Page(
                movies, if (page == 1) null
                else page - 1, page + 1
            )
        } catch (e: Throwable) {
            PagingSource.LoadResult.Error(e)
        }
    }

    override fun onCleared() {
        movieRepository.close()
        super.onCleared()
    }

}