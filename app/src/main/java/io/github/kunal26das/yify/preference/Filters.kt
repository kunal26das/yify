package io.github.kunal26das.yify.preference

import androidx.annotation.IntRange
import io.github.kunal26das.yify.model.Genre
import io.github.kunal26das.yify.model.OrderBy
import io.github.kunal26das.yify.model.Quality
import io.github.kunal26das.yify.model.SortBy

data class Filters constructor(

    @Quality
    val quality: String? = null,

    @IntRange(from = 0, to = 9)
    val minimumRating: Int? = null,

    val queryTerm: String? = null,

    @Genre
    val genre: String? = null,

    val sortBy: String? = null,

    val orderBy: String? = null,

    val withRtRating: Boolean? = null,

    val addedBefore: Long? = null,
) {

    constructor(it: MoviePreferences): this(
        quality = it.getQuality(),
        minimumRating = it.getMinimumRating(),
        queryTerm = it.getQueryTerm(),
        genre = it.getGenre(),
        sortBy = it.getSortBy(),
        orderBy = it.getOrderBy(),
    )


    constructor(addedBefore: Long) : this(
        sortBy = SortBy.date_added.name,
        orderBy = OrderBy.desc.name,
        addedBefore = addedBefore,
    )

}
