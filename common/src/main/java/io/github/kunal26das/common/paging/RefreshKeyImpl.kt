package io.github.kunal26das.common.paging

import androidx.paging.PagingState

class RefreshKeyImpl : RefreshKey {
    override fun refreshKey(state: PagingState<Int, *>): Int? {
        return state.anchorPosition?.let { anchorPosition ->
            state.closestPageToPosition(anchorPosition)?.prevKey?.plus(1)
                ?: state.closestPageToPosition(anchorPosition)?.nextKey?.minus(1)
        }
    }
}