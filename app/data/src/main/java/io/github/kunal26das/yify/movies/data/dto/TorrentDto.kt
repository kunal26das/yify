package io.github.kunal26das.yify.movies.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class TorrentDto(
    @SerialName("hash")
    val hash: String?,
    @SerialName("date_uploaded")
    val dateUploaded: String?,
    @SerialName("date_uploaded_unix")
    val dateUploadedUnix: Long?,
    @SerialName("peers")
    val peers: Int?,
    @SerialName("quality")
    val quality: String?,
    @SerialName("seeds")
    val seeds: Int?,
    @SerialName("size")
    val size: String?,
    @SerialName("size_bytes")
    val sizeBytes: Long?,
    @SerialName("type")
    val type: String?,
    @SerialName("url")
    val url: String?,
    @SerialName("is_repack")
    val isRepack: String?,
    @SerialName("video_codec")
    val videoCodec: String?,
    @SerialName("bit_depth")
    val bitDepth: String?,
    @SerialName("audio_channels")
    val audioChannels: String?,
)