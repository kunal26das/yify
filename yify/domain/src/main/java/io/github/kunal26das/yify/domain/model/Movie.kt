package io.github.kunal26das.yify.domain.model

data class Movie constructor(
    val id: Int,
    val backgroundImageUrl: String?,
    val cast: List<Cast>,
    val coverImageUrl: String?,
    val dateUploaded: Long,
    val descriptionFull: String,
    val descriptionIntro: String,
    val downloadCount: Int,
    val genres: List<Genre>,
    val imdbCode: String,
    val language: String,
    val likeCount: Int,
    val mpaRating: String,
    val quality: Quality,
    val rating: Float,
    val runtime: Int,
    val slug: String,
    val state: String,
    val screenshotUrls: List<String>,
    val summary: String,
    val synopsis: String,
    val title: String,
    val titleEnglish: String,
    val titleLong: String,
    val trailerImageUrl: String?,
    val torrents: List<Torrent>,
    val url: String?,
    val year: Int?,
)