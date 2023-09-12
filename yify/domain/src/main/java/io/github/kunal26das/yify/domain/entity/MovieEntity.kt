package io.github.kunal26das.yify.domain.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.Quality

@Entity(tableName = "movie")
data class MovieEntity constructor(
    @PrimaryKey
    @ColumnInfo("id")
    val id: Int = 0,
    @ColumnInfo("background_image_url")
    val backgroundImageUrl: String?,
    @ColumnInfo("cover_image_url")
    val coverImageUrl: String?,
    @ColumnInfo("date_uploaded")
    val dateUploaded: Long?,
    @ColumnInfo("description_full")
    val descriptionFull: String?,
    @ColumnInfo("description_intro")
    val descriptionIntro: String?,
    @ColumnInfo("download_count")
    val downloadCount: Int?,
    @ColumnInfo("genres")
    val genres: List<Genre>?,
    @ColumnInfo("imdb_code")
    val imdbCode: String?,
    @ColumnInfo("language")
    val language: String?,
    @ColumnInfo("like_count")
    val likeCount: Int?,
    @ColumnInfo("mpa_rating")
    val mpaRating: String?,
    @ColumnInfo("peers")
    val peers: Int?,
    @ColumnInfo("quality")
    val quality: Quality?,
    @ColumnInfo("rating")
    val rating: Float?,
    @ColumnInfo("runtime")
    val runtime: Int?,
    @ColumnInfo("seeds")
    val seeds: Int?,
    @ColumnInfo("slug")
    val slug: String?,
    @ColumnInfo("state")
    val state: String?,
    @ColumnInfo("summary")
    val summary: String?,
    @ColumnInfo("synopsis")
    val synopsis: String?,
    @ColumnInfo("title")
    val title: String?,
    @ColumnInfo("title_english")
    val titleEnglish: String?,
    @ColumnInfo("title_long")
    val titleLong: String?,
    @ColumnInfo("trailer_image_url")
    val trailerImageUrl: String?,
    @ColumnInfo("url")
    val url: String?,
    @ColumnInfo("year")
    val year: Int?,
)