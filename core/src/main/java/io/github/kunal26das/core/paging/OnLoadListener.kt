package io.github.kunal26das.core.paging

import androidx.paging.PagingSource

fun interface OnLoadListener<T : Any> :
    suspend (PagingSource.LoadParams<Int>) -> PagingSource.LoadResult<Int, T>