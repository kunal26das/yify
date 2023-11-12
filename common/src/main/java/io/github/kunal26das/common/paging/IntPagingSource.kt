package io.github.kunal26das.common.paging

import androidx.paging.PagingSource
import androidx.paging.PagingState

abstract class IntPagingSource<Value : Any> : PagingSource<Int, Value>() {
    final override fun getRefreshKey(state: PagingState<Int, Value>): Int? {
        return state.anchorPosition?.let { anchorPosition ->
            state.closestPageToPosition(anchorPosition)?.prevKey?.plus(1)
                ?: state.closestPageToPosition(anchorPosition)?.nextKey?.minus(1)
        }
    }
}