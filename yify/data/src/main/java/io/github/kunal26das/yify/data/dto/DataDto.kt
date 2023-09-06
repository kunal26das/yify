package io.github.kunal26das.yify.data.dto

import com.google.gson.annotations.SerializedName

data class DataDto(
    @SerializedName("movie")
    val movieDto: MovieDto?,
    @SerializedName("movies")
    val movieDtos: List<MovieDto>?,
    @SerializedName("page_number")
    val pageNumber: Int,
    @SerializedName("movie_count")
    val movieCount: Int?,
    @SerializedName("limit")
    val limit: Int?
)