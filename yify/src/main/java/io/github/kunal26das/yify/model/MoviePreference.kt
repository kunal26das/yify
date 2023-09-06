package io.github.kunal26das.yify.model

import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.Quality

sealed class MoviePreference(
    val quality: Quality? = null,
    val minimumRating: Int? = null,
    val queryTerm: String? = null,
    val genre: Genre? = null,
    val sortBy: SortBy? = null,
    val orderBy: OrderBy? = null,
    val withRtRating: Boolean? = null,
) {
    data object None : MoviePreference()
    data object Latest4K : MoviePreference(
        orderBy = OrderBy.Descending,
        sortBy = SortBy.DateAdded,
        quality = Quality.`4k`,
    )
}
