package io.github.kunal26das.yify.preference

interface MoviePreferences {
    fun getQuality(): String?
    fun getMinimumRating(): Int?
    fun getQueryTerm(): String?
    fun getGenre(): String?
    fun getSortBy(): String?
    fun getOrderBy(): String?
}