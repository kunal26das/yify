package io.github.kunal26das.yify.movies.domain.model

import java.io.Serializable

data class Movie(
    val id: Long?,
    val backgroundImageOriginalUrl: String,
    val backgroundImageUrl: String,
    val largeCoverImageUrl: String,
    val mediumCoverImageUrl: String,
    val smallCoverImageUrl: String,
    val dateUploaded: Long,
    val description: String,
    val genres: List<Genre>,
    val imdbCode: String,
    val language: Language,
    val mpaRating: String,
    val peers: Int,
    val quality: Quality?,
    val rating: Float,
    val runtime: Int,
    val seeds: Int,
    val slug: String,
    val state: String,
    val summary: String,
    val synopsis: String,
    val title: String,
    val titleEnglish: String,
    val titleLong: String,
    val torrents: List<Torrent>,
    val url: String,
    val year: Int?,
    val youtubeTrailerCode: String,
) : Serializable {
    companion object {
        const val KEY_MOVIE = "movie"
        const val KEY_MOVIE_ID = "${KEY_MOVIE}_id"
    }
}