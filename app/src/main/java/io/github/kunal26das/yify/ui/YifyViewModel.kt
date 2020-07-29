package io.github.kunal26das.yify.ui

import androidx.essentials.core.KoinComponent.inject
import androidx.essentials.core.ViewModel
import androidx.paging.LivePagedListBuilder
import io.github.kunal26das.yify.source.Yify
import io.github.kunal26das.yify.utils.Constants.PAGE_SIZE

class YifyViewModel : ViewModel() {

    private val yify: Yify by inject()
    var movies = LivePagedListBuilder(yify.dataSourceFactory, PAGE_SIZE).build()

}