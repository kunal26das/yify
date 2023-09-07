package io.github.kunal26das.yify.domain.model

sealed class OrderBy(
    val value: String,
    val name: String,
) {
    data object Ascending : OrderBy(ORDER_BY_ASCENDING, "Ascending")
    data object Descending : OrderBy(ORDER_BY_DESCENDING, "Descending")
    companion object {

        private const val ORDER_BY_ASCENDING = "asc"
        private const val ORDER_BY_DESCENDING = "desc"

        val ALL by lazy {
            OrderBy::class.sealedSubclasses
                .mapNotNull {
                    it.objectInstance
                }
        }
    }
}