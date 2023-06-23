package io.github.kunal26das.model

import android.os.Parcelable
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Entity
@Parcelize
data class Torrent(

    @PrimaryKey
    @SerializedName("hash")
    var hash: String = "",

    @SerializedName("date_uploaded")
    var dateUploaded: String? = null,

    @SerializedName("date_uploaded_unix")
    var dateUploadedUnix: Int? = null,

    @SerializedName("peers")
    var peers: Int? = null,

    @SerializedName("quality")
    var quality: String? = null,

    @SerializedName("seeds")
    var seeds: Int? = null,

    @SerializedName("size")
    var size: String? = null,

    @SerializedName("size_bytes")
    var sizeBytes: Long? = null,

    @SerializedName("type")
    var type: String? = null,

    @SerializedName("url")
    var url: String? = null,
) : Parcelable