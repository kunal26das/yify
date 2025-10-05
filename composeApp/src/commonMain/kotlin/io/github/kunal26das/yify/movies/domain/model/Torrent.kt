package io.github.kunal26das.yify.movies.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class Torrent(
    val movieId: Long?,
    val hash: String,
    val dateUploaded: Long,
    val peers: Int,
    val quality: Quality?,
    val seeds: Int,
    val size: String,
    val sizeBytes: Long,
    val type: String,
    val url: String?,
)