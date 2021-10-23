package io.github.kunal26das.yify.ui

import androidx.lifecycle.ViewModel
import androidx.paging.LivePagedListBuilder
import io.github.kunal26das.yify.source.YifyDataSource

class YifyViewModel : ViewModel() {

    val movies = LivePagedListBuilder(YifyDataSource, PAGE_SIZE).build()

    override fun onCleared() {
        super.onCleared()
        YifyDataSource.close()
    }

    companion object {
        const val PAGE_SIZE = 10
    }

}