package io.github.kunal26das.yify.source.models

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.android.parcel.Parcelize

@Parcelize
data class Meta(

    @field:SerializedName("server_time")
    val serverTime: Int,

    @field:SerializedName("server_timezone")
    val serverTimezone: String,

    @field:SerializedName("api_version")
    val apiVersion: Int,

    @field:SerializedName("execution_time")
    val executionTime: String
) : Parcelable