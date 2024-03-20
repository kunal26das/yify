package io.github.kunal26das.yify.movies.domain.model

data class Cast(
    val imdbCode: String,
    val characterName: String,
    val name: String,
    val imageUrl: String?,
)
