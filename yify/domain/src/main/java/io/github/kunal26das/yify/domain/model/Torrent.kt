package io.github.kunal26das.yify.domain.model

data class Torrent(
    val hash: String,
    val dateUploaded: Long,
    val peers: Int,
    val quality: String,
    val seeds: Int,
    val size: String,
    val sizeBytes: Long,
    val type: String,
    val url: String?,
)