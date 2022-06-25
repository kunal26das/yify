package io.github.kunal26das.yify.core

import androidx.paging.PagingSource

fun interface OnLoadListener<T : Any> :
    suspend (PagingSource.LoadParams<Int>) -> PagingSource.LoadResult<Int, T>