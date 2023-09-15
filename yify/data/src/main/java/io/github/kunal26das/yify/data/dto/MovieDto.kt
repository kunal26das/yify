package io.github.kunal26das.yify.data.dto

import com.google.gson.annotations.SerializedName

data class MovieDto constructor(
    @SerializedName("id")
    var id: Int = 0,
    @SerializedName("background_image")
    var backgroundImage: String? = null,
    @SerializedName("background_image_original")
    var backgroundImageOriginal: String? = null,
    @SerializedName("date_uploaded")
    var dateUploaded: String? = null,
    @SerializedName("date_uploaded_unix")
    var dateUploadedUnix: Long? = null,
    @SerializedName("description_full")
    var descriptionFull: String? = null,
    @SerializedName("genres")
    var genres: List<String>? = null,
    @SerializedName("imdb_code")
    var imdbCode: String? = null,
    @SerializedName("language")
    var language: String? = null,
    @SerializedName("large_cover_image")
    var largeCoverImage: String? = null,
    @SerializedName("medium_cover_image")
    var mediumCoverImage: String? = null,
    @SerializedName("mpa_rating")
    var mpaRating: String? = null,
    @SerializedName("rating")
    var rating: Double? = null,
    @SerializedName("runtime")
    var runtime: Int? = null,
    @SerializedName("slug")
    var slug: String? = null,
    @SerializedName("small_cover_image")
    var smallCoverImage: String? = null,
    @SerializedName("state")
    var state: String? = null,
    @SerializedName("summary")
    var summary: String? = null,
    @SerializedName("synopsis")
    var synopsis: String? = null,
    @SerializedName("title")
    var title: String? = null,
    @SerializedName("title_english")
    var titleEnglish: String? = null,
    @SerializedName("title_long")
    var titleLong: String? = null,
    @SerializedName("torrents")
    var torrentDtos: List<TorrentDto>? = null,
    @SerializedName("url")
    var url: String? = null,
    @SerializedName("year")
    var year: Int? = null,
    @SerializedName("yt_trailer_code")
    var youtubeTrailerCode: String? = null,
)