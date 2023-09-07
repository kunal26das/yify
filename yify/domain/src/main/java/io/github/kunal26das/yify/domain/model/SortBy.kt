package io.github.kunal26das.yify.domain.model

sealed class SortBy(val value: String, val name: String) {
    data object Title : SortBy(SORT_BY_TITLE, "Title")
    data object Year : SortBy(SORT_BY_YEAR, "Year")
    data object Rating : SortBy(SORT_BY_RATING, "Rating")
    data object Peers : SortBy(SORT_BY_PEERS, "Peers")
    data object Seeds : SortBy(SORT_BY_SEEDS, "Seeds")
    data object DownloadCount : SortBy(SORT_BY_DOWNLOAD_COUNT, "Downloads")
    data object LikeCount : SortBy(SORT_BY_LIKE_COUNT, "Likes")
    data object DateAdded : SortBy(SORT_BY_DATE_ADDED, "Date Added")

    companion object {

        private const val SORT_BY_TITLE = "title"
        private const val SORT_BY_YEAR = "year"
        private const val SORT_BY_RATING = "rating"
        private const val SORT_BY_PEERS = "peers"
        private const val SORT_BY_SEEDS = "seeds"
        private const val SORT_BY_DOWNLOAD_COUNT = "download_count"
        private const val SORT_BY_LIKE_COUNT = "like_count"
        private const val SORT_BY_DATE_ADDED = "date_added"

        val ALL by lazy {
            SortBy::class.sealedSubclasses
                .mapNotNull {
                    it.objectInstance
                }
        }
    }
}