package io.github.kunal26das.yify.models

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Parcelize
data class Movie(

    @SerializedName("small_cover_image")
    val smallCoverImage: String,

    @SerializedName("year")
    val year: Int,

    @SerializedName("description_full")
    val descriptionFull: String,

    @SerializedName("rating")
    val rating: Double,

    @SerializedName("large_cover_image")
    val largeCoverImage: String,

    @SerializedName("title_long")
    val titleLong: String,

    @SerializedName("language")
    val language: String,

    @SerializedName("yt_trailer_code")
    val ytTrailerCode: String,

    @SerializedName("title")
    val title: String,

    @SerializedName("mpa_rating")
    val mpaRating: String,

    @SerializedName("genres")
    val genres: List<String>,

    @SerializedName("title_english")
    val titleEnglish: String,

    @SerializedName("id")
    val id: Int,

    @SerializedName("state")
    val state: String,

    @SerializedName("slug")
    val slug: String,

    @SerializedName("summary")
    val summary: String,

    @SerializedName("date_uploaded")
    val dateUploaded: String,

    @SerializedName("runtime")
    val runtime: Int,

    @SerializedName("synopsis")
    val synopsis: String,

    @SerializedName("url")
    val url: String,

    @SerializedName("imdb_code")
    val imdbCode: String,

    @SerializedName("background_image")
    val backgroundImage: String,

    @SerializedName("torrents")
    val torrents: List<Torrent>,

    @SerializedName("date_uploaded_unix")
    val dateUploadedUnix: Int,

    @SerializedName("background_image_original")
    val backgroundImageOriginal: String,

    @SerializedName("medium_cover_image")
    val mediumCoverImage: String
) : Parcelable