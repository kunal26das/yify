package io.github.kunal26das.yify.data.model

import com.google.gson.annotations.SerializedName

data class Data(
    @SerializedName("movie")
    val movieModel: MovieModel?,
    @SerializedName("movies")
    val movieModels: List<MovieModel>?,
    @SerializedName("page_number")
    val pageNumber: Int,
    @SerializedName("movie_count")
    val movieCount: Int?,
    @SerializedName("limit")
    val limit: Int?
)