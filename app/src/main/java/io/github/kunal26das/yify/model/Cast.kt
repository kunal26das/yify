package io.github.kunal26das.yify.model

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Parcelize
data class Cast(
    @SerializedName("imdb_code")
    val imdbCode: String,

    @SerializedName("character_name")
    val characterName: String?,

    @SerializedName("name")
    val name: String?,

    @SerializedName("url_small_image")
    val urlSmallImage: String?,
) : Parcelable
