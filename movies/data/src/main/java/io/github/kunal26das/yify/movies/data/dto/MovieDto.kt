package io.github.kunal26das.yify.movies.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class MovieDto(
    @SerialName("id")
    var id: Long?,
    @SerialName("background_image")
    var backgroundImage: String?,
    @SerialName("background_image_original")
    var backgroundImageOriginal: String?,
    @SerialName("date_uploaded")
    var dateUploaded: String?,
    @SerialName("date_uploaded_unix")
    var dateUploadedUnix: Long?,
    @SerialName("description_full")
    var descriptionFull: String?,
    @SerialName("genres")
    var genres: List<String>?,
    @SerialName("imdb_code")
    var imdbCode: String?,
    @SerialName("language")
    var language: String?,
    @SerialName("large_cover_image")
    var largeCoverImage: String?,
    @SerialName("medium_cover_image")
    var mediumCoverImage: String?,
    @SerialName("mpa_rating")
    var mpaRating: String?,
    @SerialName("rating")
    var rating: Double?,
    @SerialName("runtime")
    var runtime: Int?,
    @SerialName("slug")
    var slug: String?,
    @SerialName("small_cover_image")
    var smallCoverImage: String?,
    @SerialName("state")
    var state: String?,
    @SerialName("summary")
    var summary: String?,
    @SerialName("synopsis")
    var synopsis: String?,
    @SerialName("title")
    var title: String?,
    @SerialName("title_english")
    var titleEnglish: String?,
    @SerialName("title_long")
    var titleLong: String?,
    @SerialName("torrents")
    var torrentDtos: List<TorrentDto>?,
    @SerialName("url")
    var url: String?,
    @SerialName("year")
    var year: Int?,
    @SerialName("yt_trailer_code")
    var youtubeTrailerCode: String?,
)