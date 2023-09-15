package io.github.kunal26das.yify.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class MoviePreference constructor(
    val quality: Quality? = null,
    val minimumRating: Int? = null,
    val queryTerm: String? = null,
    val genre: Genre? = null,
    val sortBy: SortBy? = null,
    val orderBy: OrderBy? = null,
) {
    companion object {
        val Default = MoviePreference(
            minimumRating = 0,
            sortBy = SortBy.DateAdded,
            orderBy = OrderBy.Descending,
        )
    }
}