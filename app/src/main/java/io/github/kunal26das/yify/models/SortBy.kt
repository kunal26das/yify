package io.github.kunal26das.yify.models

import androidx.annotation.StringDef
import io.github.kunal26das.yify.models.SortBy.Companion.SORT_BY_DATE_ADDED
import io.github.kunal26das.yify.models.SortBy.Companion.SORT_BY_DOWNLOAD_COUNT
import io.github.kunal26das.yify.models.SortBy.Companion.SORT_BY_LIKE_COUNT
import io.github.kunal26das.yify.models.SortBy.Companion.SORT_BY_PEERS
import io.github.kunal26das.yify.models.SortBy.Companion.SORT_BY_RATING
import io.github.kunal26das.yify.models.SortBy.Companion.SORT_BY_SEEDS
import io.github.kunal26das.yify.models.SortBy.Companion.SORT_BY_TITLE
import io.github.kunal26das.yify.models.SortBy.Companion.SORT_BY_YEAR

@StringDef(
    SORT_BY_TITLE,
    SORT_BY_YEAR,
    SORT_BY_RATING,
    SORT_BY_PEERS,
    SORT_BY_SEEDS,
    SORT_BY_DOWNLOAD_COUNT,
    SORT_BY_LIKE_COUNT,
    SORT_BY_DATE_ADDED,
)
annotation class SortBy {
    companion object {
        const val SORT_BY_TITLE = "title"
        const val SORT_BY_YEAR = "year"
        const val SORT_BY_RATING = "rating"
        const val SORT_BY_PEERS = "peers"
        const val SORT_BY_SEEDS = "seeds"
        const val SORT_BY_DOWNLOAD_COUNT = "download_count"
        const val SORT_BY_LIKE_COUNT = "like_count"
        const val SORT_BY_DATE_ADDED = "date_added"
    }
}