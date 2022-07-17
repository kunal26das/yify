package io.github.kunal26das.yify.movie.list

import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.*
import io.github.kunal26das.model.Movie
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch

abstract class MovieListViewModel : ViewModel() {

    private var job: Job? = null
    val movies = MutableLiveData<Flow<PagingData<Movie>>>()

    abstract fun refresh(
        delayTimeMillis: Long = 0L,
    )

    protected fun refresh(
        delayTimeMillis: Long,
        pagingSourceFactory: () -> PagingSource<Int, Movie>,
    ) {
        job?.cancel()
        job = viewModelScope.launch {
            delay(delayTimeMillis)
            movies.postValue(
                Pager(
                    config = PagingConfig(
                        initialLoadSize = LOAD_SIZE,
                        pageSize = LOAD_SIZE,
                    ),
                    pagingSourceFactory = pagingSourceFactory,
                ).flow.cachedIn(viewModelScope)
            )
        }
    }

    override fun onCleared() {
        super.onCleared()
        job?.cancel()
    }

    companion object {
        const val LOAD_SIZE = 10
    }

}