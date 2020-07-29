package io.github.kunal26das.yify.source.models

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.android.parcel.Parcelize

@Parcelize
data class Torrent(

    @field:SerializedName("size_bytes")
    val sizeBytes: Long,

    @field:SerializedName("size")
    val size: String,

    @field:SerializedName("seeds")
    val seeds: Int,

    @field:SerializedName("date_uploaded")
    val dateUploaded: String,

    @field:SerializedName("peers")
    val peers: Int,

    @field:SerializedName("date_uploaded_unix")
    val dateUploadedUnix: Int,

    @field:SerializedName("type")
    val type: String,

    @field:SerializedName("url")
    val url: String,

    @field:SerializedName("hash")
    val hash: String,

    @field:SerializedName("quality")
    val quality: String
) : Parcelable