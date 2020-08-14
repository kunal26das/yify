package io.github.kunal26das.yify.ui

import androidx.essentials.core.KoinComponent.inject
import androidx.essentials.core.ViewModel
import androidx.paging.LivePagedListBuilder
import io.github.kunal26das.yify.source.YifyDataSource
import io.github.kunal26das.yify.utils.Constants.PAGE_SIZE

class YifyViewModel : ViewModel() {

    private val yifyDataSource: YifyDataSource by inject()
    var movies = LivePagedListBuilder(yifyDataSource.factory, PAGE_SIZE).build()

    override fun onCleared() {
        super.onCleared()
        yifyDataSource.clear()
    }

}