package io.github.kunal26das.yify.ui

import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.cachedIn
import io.github.kunal26das.yify.source.PagingSource

open class ViewModel : ViewModel() {

    val loading = MutableLiveData<Boolean>()

    fun <T : Any> ViewModel.flow(
        onLoadListener: OnLoadListener<T>
    ) = lazy {
        Pager(PagingConfig(10)) {
            object : PagingSource<T>() {
                override suspend fun load(
                    params: LoadParams<Int>
                ): LoadResult<Int, T> {
                    loading.postValue(true)
                    val result = onLoadListener.load(params)
                    loading.postValue(false)
                    return result
                }
            }
        }.flow.cachedIn(viewModelScope)
    }

}