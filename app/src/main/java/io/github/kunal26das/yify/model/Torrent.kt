package io.github.kunal26das.yify.model

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Parcelize
data class Torrent(

    @SerializedName("hash")
    val hash: String,

    @SerializedName("date_uploaded")
    val dateUploaded: String?,

    @SerializedName("date_uploaded_unix")
    val dateUploadedUnix: Int?,

    @SerializedName("peers")
    val peers: Int?,

    @SerializedName("quality")
    val quality: String?,

    @SerializedName("seeds")
    val seeds: Int?,

    @SerializedName("size")
    val size: String?,

    @SerializedName("size_bytes")
    val sizeBytes: Long?,

    @SerializedName("type")
    val type: String?,

    @SerializedName("url")
    val url: String?,
) : Parcelable