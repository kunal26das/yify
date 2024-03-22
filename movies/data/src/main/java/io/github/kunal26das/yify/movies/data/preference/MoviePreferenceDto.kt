package io.github.kunal26das.yify.movies.data.preference

import kotlinx.serialization.Serializable

@Serializable
data class MoviePreferenceDto(
    val quality: Int? = null,
    val minimumRating: Int? = null,
    val queryTerm: String? = null,
    val genre: String? = null,
    val sortBy: String? = null,
    val orderBy: String? = null,
)