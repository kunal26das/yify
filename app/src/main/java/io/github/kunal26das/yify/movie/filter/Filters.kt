package io.github.kunal26das.yify.movie.filter

import android.content.SharedPreferences
import androidx.annotation.IntRange
import androidx.essentials.network.get
import io.github.kunal26das.model.*

data class Filters(

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

    constructor(sharedPreferences: SharedPreferences) : this(
        sharedPreferences[Preference.quality],
        sharedPreferences[Preference.minimum_rating],
        sharedPreferences[Preference.query_term],
        sharedPreferences[Preference.genre],
        sharedPreferences[Preference.sort_by],
        sharedPreferences[Preference.order_by],
    )

    constructor(addedBefore: Long) : this(
        sortBy = SortBy.date_added.name,
        orderBy = OrderBy.desc.name,
        addedBefore = addedBefore,
    )

}
