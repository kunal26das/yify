package io.github.kunal26das.yify.movies.domain.preference

import io.github.kunal26das.yify.movies.domain.model.Genre
import io.github.kunal26das.yify.movies.domain.model.OrderBy
import io.github.kunal26das.yify.movies.domain.model.Quality
import io.github.kunal26das.yify.movies.domain.model.SortBy

data class MoviePreference(
    val quality: Quality? = null,
    val minimumRating: Int? = null,
    val queryTerm: String? = null,
    val genre: Genre? = null,
    val sortBy: SortBy? = null,
    val orderBy: OrderBy? = null,
) {
    companion object {
        val Default
            get() = MoviePreference(
                minimumRating = 0,
                sortBy = SortBy.DateAdded,
                orderBy = OrderBy.Descending,
            )
    }
}