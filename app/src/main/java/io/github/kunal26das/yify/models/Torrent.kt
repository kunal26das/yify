package io.github.kunal26das.yify.models

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Parcelize
data class Torrent(

    @SerializedName("size_bytes")
    val sizeBytes: Long,

    @SerializedName("size")
    val size: String,

    @SerializedName("seeds")
    val seeds: Int,

    @SerializedName("date_uploaded")
    val dateUploaded: String,

    @SerializedName("peers")
    val peers: Int,

    @SerializedName("date_uploaded_unix")
    val dateUploadedUnix: Int,

    @SerializedName("type")
    val type: String,

    @SerializedName("url")
    val url: String,

    @SerializedName("hash")
    val hash: String,

    @SerializedName("quality")
    val quality: String
) : Parcelable