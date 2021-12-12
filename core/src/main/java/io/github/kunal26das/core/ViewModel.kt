package io.github.kunal26das.core

import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.cachedIn
import io.github.kunal26das.core.paging.OnLoadListener
import io.github.kunal26das.core.paging.PagingSource

abstract class ViewModel : ViewModel() {

    val loading = MutableLiveData<Boolean>()
    val error = MutableLiveData<Throwable?>()

    fun <T : Any> ViewModel.flow(
        pageSize: Int, onLoadListener: OnLoadListener<T>
    ) = lazy {
        Pager(PagingConfig(pageSize)) {
            object : PagingSource<T>() {
                override suspend fun load(
                    params: LoadParams<Int>
                ): LoadResult<Int, T> {
                    loading.postValue(true)
                    val result = onLoadListener.load(params)
                    loading.postValue(false)
                    if (result is LoadResult.Error<*, *>) {
                        error.postValue(result.throwable)
                    } else error.postValue(null)
                    return result
                }
            }
        }.flow.cachedIn(viewModelScope)
    }

}