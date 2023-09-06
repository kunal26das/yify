package io.github.kunal26das.yify.model

sealed class SortBy(
    val name: String
) {
    data object Title : SortBy("title")
    data object Year : SortBy("year")
    data object Rating : SortBy("rating")
    data object Peers : SortBy("peers")
    data object Seeds : SortBy("seeds")
    data object DownloadCount : SortBy("download_count")
    data object LikeCount : SortBy("like_count")
    data object DateAdded : SortBy("date_added")
}