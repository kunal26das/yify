package io.github.kunal26das.yify.model

sealed class OrderBy(
    val name: String
) {
    data object Ascending : OrderBy("asc")
    data object Descending : OrderBy("desc")
}