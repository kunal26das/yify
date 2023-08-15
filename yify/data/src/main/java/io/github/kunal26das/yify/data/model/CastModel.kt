package io.github.kunal26das.yify.data.model

import com.google.gson.annotations.SerializedName

data class CastModel(
    @SerializedName("imdb_code")
    val imdbCode: String,

    @SerializedName("character_name")
    val characterName: String?,

    @SerializedName("name")
    val name: String?,

    @SerializedName("url_small_image")
    val urlSmallImage: String?,
)
