package io.github.kunal26das.yify.domain.model

import java.io.Serializable

@kotlinx.serialization.Serializable
data class Torrent constructor(
    val movieId: Int,
    val hash: String,
    val dateUploaded: Long,
    val peers: Int,
    val quality: Quality,
    val seeds: Int,
    val size: String,
    val sizeBytes: Long,
    val type: String,
    val url: String?,
): Serializable