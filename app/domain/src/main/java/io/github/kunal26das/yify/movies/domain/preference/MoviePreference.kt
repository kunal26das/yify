package io.github.kunal26das.yify.movies.domain.preference

import io.github.kunal26das.yify.movies.domain.model.Genre
import io.github.kunal26das.yify.movies.domain.model.OrderBy
import io.github.kunal26das.yify.movies.domain.model.Quality
import io.github.kunal26das.yify.movies.domain.model.SortBy

data class MoviePreference(
    val quality: Quality,
    val minimumRating: Int,
    val queryTerm: String,
    val genre: Genre? = null,
    val sortBy: SortBy,
    val orderBy: OrderBy,
) {
    companion object {
        val Default
            get() = MoviePreference(
                quality = Quality.High,
                minimumRating = 0,
                queryTerm = "",
                sortBy = SortBy.DateAdded,
                orderBy = OrderBy.Descending,
            )
    }
}