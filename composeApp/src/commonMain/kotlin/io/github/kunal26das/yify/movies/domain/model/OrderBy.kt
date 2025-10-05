package io.github.kunal26das.yify.movies.domain.model

enum class OrderBy {
    Ascending,
    Descending,
    ;

    companion object {
        operator fun get(orderBy: String?): OrderBy? {
            return try {
                OrderBy.valueOf(orderBy!!)
            } catch (e: Exception) {
                null
            }
        }
    }
}