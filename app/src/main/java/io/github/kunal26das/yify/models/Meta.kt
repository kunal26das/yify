package io.github.kunal26das.yify.models

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Parcelize
data class Meta(

    @SerializedName("server_time")
    val serverTime: Int,

    @SerializedName("server_timezone")
    val serverTimezone: String,

    @SerializedName("api_version")
    val apiVersion: Int,

    @SerializedName("execution_time")
    val executionTime: String
) : Parcelable