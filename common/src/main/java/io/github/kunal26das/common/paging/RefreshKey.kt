package io.github.kunal26das.common.paging

import androidx.paging.PagingState

interface RefreshKey {
    fun refreshKey(state: PagingState<Int, *>): Int?
}