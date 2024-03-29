package io.github.kunal26das.yify.movies.data.mapper

import io.github.kunal26das.yify.movies.domain.model.SortBy

private const val SORT_BY_TITLE = "title"
private const val SORT_BY_YEAR = "year"
private const val SORT_BY_RATING = "rating"
private const val SORT_BY_PEERS = "peers"
private const val SORT_BY_SEEDS = "seeds"
private const val SORT_BY_DATE_ADDED = "date_added"

internal val SortBy.key
    get() = when (this) {
        SortBy.DateAdded -> SORT_BY_DATE_ADDED
        SortBy.Peers -> SORT_BY_PEERS
        SortBy.Rating -> SORT_BY_RATING
        SortBy.Seeds -> SORT_BY_SEEDS
        SortBy.Title -> SORT_BY_TITLE
        SortBy.Year -> SORT_BY_YEAR
    }