package io.github.kunal26das.common

import androidx.paging.PagingSource

interface PagingSourceFactory<T : PagingSource<*, *>> : () -> T