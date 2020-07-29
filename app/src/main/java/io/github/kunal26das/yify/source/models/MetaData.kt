package io.github.kunal26das.yify.source.models

import com.google.gson.annotations.SerializedName

data class MetaData(

    @SerializedName("server_time")
    val serverTime: Int? = null,

    @SerializedName("server_timezone")
    val serverTimezone: String? = null,

    @SerializedName("api_version")
    val apiVersion: Int? = null,

    @SerializedName("execution_time")
    val executionTime: String? = null
)