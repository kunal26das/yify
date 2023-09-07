package io.github.kunal26das.yify.data.mapper

import io.github.kunal26das.yify.domain.model.OrderBy

private const val ORDER_BY_ASCENDING = "asc"
private const val ORDER_BY_DESCENDING = "desc"

val OrderBy.key: String
    get() = when (this) {
        OrderBy.Ascending -> ORDER_BY_ASCENDING
        OrderBy.Descending -> ORDER_BY_DESCENDING
    }