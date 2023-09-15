package io.github.kunal26das.yify.domain.model

import java.util.Locale

data class Movie constructor(
    val id: Int,
    val backgroundImageUrl: String?,
    val coverImageUrl: String?,
    val dateUploaded: Long,
    val description: String,
    val genres: List<Genre>,
    val imdbCode: String,
    val languageCode: String,
    val mpaRating: String,
    val quality: Quality,
    val rating: Float,
    val runtime: Int,
    val slug: String,
    val state: String,
    val summary: String,
    val synopsis: String,
    val title: String,
    val titleEnglish: String,
    val titleLong: String,
    val trailerImageUrl: String?,
    val torrents: List<Torrent>,
    val url: String?,
    val year: Int?,
    val youtubeTrailerUrl: String?,
) {

    val displayLanguage by lazy {
        Locale(languageCode).displayLanguage
    }

    companion object {
        const val KEY_MOVIE_ID = "movie_id"
    }
}