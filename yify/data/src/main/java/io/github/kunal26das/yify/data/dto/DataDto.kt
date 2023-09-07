package io.github.kunal26das.yify.data.dto

import com.google.gson.annotations.SerializedName

data class DataDto(
    @SerializedName("movie")
    val movie: MovieDto?,
    @SerializedName("movies")
    val movies: List<MovieDto>?,
    @SerializedName("page_number")
    val pageNumber: Int,
    @SerializedName("movie_count")
    val movieCount: Int?,
    @SerializedName("limit")
    val limit: Int?
)