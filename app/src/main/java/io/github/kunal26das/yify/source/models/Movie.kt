package io.github.kunal26das.yify.source.models

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.android.parcel.Parcelize

@Parcelize
data class Movie(

    @SerializedName("small_cover_image")
    val smallCoverImage: String? = null,

    @SerializedName("year")
    val year: Int? = null,

    @SerializedName("description_full")
    val descriptionFull: String? = null,

    @SerializedName("rating")
    val rating: Double? = null,

    @SerializedName("large_cover_image")
    val largeCoverImage: String? = null,

    @SerializedName("title_long")
    val titleLong: String? = null,

    @SerializedName("language")
    val language: String? = null,

    @SerializedName("yt_trailer_code")
    val ytTrailerCode: String? = null,

    @SerializedName("title")
    val title: String? = null,

    @SerializedName("mpa_rating")
    val mpaRating: String? = null,

    @SerializedName("genres")
    val genres: List<String>? = null,

    @SerializedName("title_english")
    val titleEnglish: String? = null,

    @SerializedName("id")
    val id: Int? = null,

    @SerializedName("state")
    val state: String? = null,

    @SerializedName("slug")
    val slug: String? = null,

    @SerializedName("summary")
    val summary: String? = null,

    @SerializedName("date_uploaded")
    val dateUploaded: String? = null,

    @SerializedName("runtime")
    val runtime: Int? = null,

    @SerializedName("synopsis")
    val synopsis: String? = null,

    @SerializedName("url")
    val url: String? = null,

    @SerializedName("imdb_code")
    val imdbCode: String? = null,

    @SerializedName("background_image")
    val backgroundImage: String? = null,

    @SerializedName("torrents")
    val torrents: List<Torrent>? = emptyList(),

    @SerializedName("date_uploaded_unix")
    val dateUploadedUnix: Int? = null,

    @SerializedName("background_image_original")
    val backgroundImageOriginal: String? = null,

    @SerializedName("medium_cover_image")
    val mediumCoverImage: String? = null
) : Parcelable

@Parcelize
data class Torrent(

    @SerializedName("size_bytes")
    val sizeBytes: Long? = null,

    @SerializedName("size")
    val size: String? = null,

    @SerializedName("seeds")
    val seeds: Int? = null,

    @SerializedName("date_uploaded")
    val dateUploaded: String? = null,

    @SerializedName("peers")
    val peers: Int? = null,

    @SerializedName("date_uploaded_unix")
    val dateUploadedUnix: Int? = null,

    @SerializedName("type")
    val type: String? = null,

    @SerializedName("url")
    val url: String? = null,

    @SerializedName("hash")
    val hash: String? = null,

    @SerializedName("quality")
    val quality: String? = null
) : Parcelable