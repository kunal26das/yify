package io.github.kunal26das.yify.movies.data.mapper

import io.github.kunal26das.yify.movies.domain.model.Quality

private const val QUALITY_720p = "720p"
private const val QUALITY_1080p = "1080p"
private const val QUALITY_2160p = "2160p"
private const val QUALITY_3D = "3D"
private const val QUALITY_ALL = "All"

val String.toQuality
    get() = when (this) {
        QUALITY_720p -> Quality.Low
        QUALITY_1080p -> Quality.Medium
        QUALITY_2160p -> Quality.High
        else -> null
    }

val Quality.key
    get() = when (this) {
        Quality.Low -> QUALITY_720p
        Quality.Medium -> QUALITY_1080p
        Quality.High -> QUALITY_2160p
        else -> QUALITY_ALL
    }