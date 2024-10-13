package io.github.kunal26das.yify.movies.domain.model

import androidx.annotation.Keep

@Keep
enum class SortBy {
    Title,
    Year,
    Rating,
    Peers,
    Seeds,
    DateAdded,
    ;

    companion object {
        operator fun get(sortBy: String?): SortBy? {
            return try {
                SortBy.valueOf(sortBy!!)
            } catch (e: Exception) {
                null
            }
        }
    }
}