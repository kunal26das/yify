package io.github.kunal26das.yify.source.models

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.android.parcel.Parcelize

@Parcelize
data class Response(

    @field:SerializedName("status_message")
    val statusMessage: String,

    @field:SerializedName("data")
    val data: Data,

    @field:SerializedName("@meta")
    val meta: Meta,

    @field:SerializedName("status")
    val status: String
) : Parcelable