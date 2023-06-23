package io.github.kunal26das.yify.preference

interface MutableMoviePreferences {
    fun setQuality(quality: String?)
    fun setMinimumRating(minimumRating: Int?)
    fun setQueryTerm(queryTerm: String?)
    fun setGenre(genre: String?)
    fun setSortBy(sortBy: String?)
    fun setOrderBy(orderBy: String?)
    fun setMovieCount(movieCount: Int?)
}