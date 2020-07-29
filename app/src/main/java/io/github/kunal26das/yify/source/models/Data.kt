package io.github.kunal26das.yify.source.models

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.android.parcel.Parcelize

@Parcelize
data class Data(

    @field:SerializedName("movies")
    val movies: List<Movie>,

    @field:SerializedName("page_number")
    val pageNumber: Int,

    @field:SerializedName("movie_count")
    val movieCount: Int,

    @field:SerializedName("limit")
    val limit: Int
) : Parcelable