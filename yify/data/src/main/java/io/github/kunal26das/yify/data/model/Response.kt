package io.github.kunal26das.yify.data.model

import com.google.gson.annotations.SerializedName

data class Response(
    @SerializedName("data")
    val data: Data,
)