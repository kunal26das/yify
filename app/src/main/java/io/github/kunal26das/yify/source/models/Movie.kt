package io.github.kunal26das.yify.source.models

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.android.parcel.Parcelize

@Parcelize
data class Movie(

    @field:SerializedName("small_cover_image")
    val smallCoverImage: String,

    @field:SerializedName("year")
    val year: Int,

    @field:SerializedName("description_full")
    val descriptionFull: String,

    @field:SerializedName("rating")
    val rating: Double,

    @field:SerializedName("large_cover_image")
    val largeCoverImage: String,

    @field:SerializedName("title_long")
    val titleLong: String,

    @field:SerializedName("language")
    val language: String,

    @field:SerializedName("yt_trailer_code")
    val ytTrailerCode: String,

    @field:SerializedName("title")
    val title: String,

    @field:SerializedName("mpa_rating")
    val mpaRating: String,

    @field:SerializedName("genres")
    val genres: List<String>,

    @field:SerializedName("title_english")
    val titleEnglish: String,

    @field:SerializedName("id")
    val id: Int,

    @field:SerializedName("state")
    val state: String,

    @field:SerializedName("slug")
    val slug: String,

    @field:SerializedName("summary")
    val summary: String,

    @field:SerializedName("date_uploaded")
    val dateUploaded: String,

    @field:SerializedName("runtime")
    val runtime: Int,

    @field:SerializedName("synopsis")
    val synopsis: String,

    @field:SerializedName("url")
    val url: String,

    @field:SerializedName("imdb_code")
    val imdbCode: String,

    @field:SerializedName("background_image")
    val backgroundImage: String,

    @field:SerializedName("torrents")
    val torrents: List<Torrent>,

    @field:SerializedName("date_uploaded_unix")
    val dateUploadedUnix: Int,

    @field:SerializedName("background_image_original")
    val backgroundImageOriginal: String,

    @field:SerializedName("medium_cover_image")
    val mediumCoverImage: String
) : Parcelable