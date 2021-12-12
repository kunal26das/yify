package io.github.kunal26das.core.paging

import androidx.paging.PagingSource

fun interface OnLoadListener<T : Any> {
    suspend fun load(
        params: PagingSource.LoadParams<Int>
    ): PagingSource.LoadResult<Int, T>
}