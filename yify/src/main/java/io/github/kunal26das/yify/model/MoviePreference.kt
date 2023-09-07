package io.github.kunal26das.yify.model

import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.OrderBy
import io.github.kunal26das.yify.domain.model.Quality
import io.github.kunal26das.yify.domain.model.Rating
import io.github.kunal26das.yify.domain.model.SortBy

data class MoviePreference constructor(
    val quality: Quality? = null,
    val minimumRating: Rating? = null,
    val queryTerm: String? = null,
    val genre: Genre? = null,
    val sortBy: SortBy? = null,
    val orderBy: OrderBy? = null,
    val withRtRating: Boolean? = null,
)
