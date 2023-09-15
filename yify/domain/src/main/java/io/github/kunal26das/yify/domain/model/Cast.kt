package io.github.kunal26das.yify.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class Cast(
    val imdbCode: String,
    val characterName: String,
    val name: String,
    val imageUrl: String?,
)
