package io.github.kunal26das.yify.data.dto

import com.google.gson.annotations.SerializedName

data class MovieDto(
    @SerializedName("id")
    var id: Int = 0,
    @SerializedName("background_image")
    var backgroundImage: String? = null,
    @SerializedName("background_image_original")
    var backgroundImageOriginal: String? = null,
    @SerializedName("cast")
    var cast: List<CastDto>? = null,
    @SerializedName("date_uploaded")
    var dateUploaded: String? = null,
    @SerializedName("date_uploaded_unix")
    var dateUploadedUnix: Long? = null,
    @SerializedName("description_full")
    var descriptionFull: String? = null,
    @SerializedName("description_intro")
    var descriptionIntro: String? = null,
    @SerializedName("download_count")
    var downloadCount: Int? = null,
    @SerializedName("genres")
    var genres: List<String>? = null,
    @SerializedName("imdb_code")
    var imdbCode: String? = null,
    @SerializedName("language")
    var language: String? = null,
    @SerializedName("large_cover_image")
    var largeCoverImage: String? = null,
    @SerializedName("large_screenshot_image1")
    var largeScreenshotImage1: String? = null,
    @SerializedName("large_screenshot_image2")
    var largeScreenshotImage2: String? = null,
    @SerializedName("large_screenshot_image3")
    var largeScreenshotImage3: String? = null,
    @SerializedName("like_count")
    var likeCount: Int? = null,
    @SerializedName("medium_cover_image")
    var mediumCoverImage: String? = null,
    @SerializedName("medium_screenshot_image1")
    var mediumScreenshotImage1: String? = null,
    @SerializedName("medium_screenshot_image2")
    var mediumScreenshotImage2: String? = null,
    @SerializedName("medium_screenshot_image3")
    var mediumScreenshotImage3: String? = null,
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
    var ytTrailerCode: String? = null,
)