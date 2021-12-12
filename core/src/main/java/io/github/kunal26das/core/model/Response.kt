package io.github.kunal26das.core.model

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Parcelize
data class Response(
    @SerializedName("data")
    val data: Data
) : Parcelable