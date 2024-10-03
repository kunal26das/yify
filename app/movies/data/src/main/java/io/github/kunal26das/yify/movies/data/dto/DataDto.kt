package io.github.kunal26das.yify.movies.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DataDto(
    @SerialName("movie")
    val movie: MovieDto?,
    @SerialName("movies")
    val movies: List<MovieDto>?,
    @SerialName("page_number")
    val pageNumber: Int,
    @SerialName("movie_count")
    val movieCount: Long?,
    @SerialName("limit")
    val limit: Int?
)