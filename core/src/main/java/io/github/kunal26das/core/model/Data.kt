package io.github.kunal26das.core.model

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Parcelize
data class Data(
    @SerializedName("movies")
    val movies: List<Movie>,

    @SerializedName("page_number")
    val pageNumber: Int,

    @SerializedName("movie_count")
    val movieCount: Int,

    @SerializedName("limit")
    val limit: Int
) : Parcelable