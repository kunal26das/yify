package io.github.kunal26das.yify.source.models

import com.google.gson.annotations.SerializedName

data class MovieData(

    @SerializedName("movies")
    val movies: List<Movie>? = emptyList(),

    @SerializedName("page_number")
    val pageNumber: Int? = null,

    @SerializedName("movie_count")
    val movieCount: Int? = null,

    @SerializedName("limit")
    val limit: Int? = null
)

data class MovieDataResponse(

    @SerializedName("status_message")
    val statusMessage: String? = null,

    @SerializedName("data")
    val movieData: MovieData? = null,

    @SerializedName("@meta")
    val metaData: MetaData? = null,

    @SerializedName("status")
    val status: String? = null
)