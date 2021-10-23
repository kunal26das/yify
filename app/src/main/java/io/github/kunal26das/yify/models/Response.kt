package io.github.kunal26das.yify.models

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Parcelize
data class Response(

    @SerializedName("status_message")
    val statusMessage: String,

    @SerializedName("data")
    val data: Data,

    @SerializedName("@meta")
    val meta: Meta,

    @SerializedName("status")
    val status: String
) : Parcelable