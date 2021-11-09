package io.github.kunal26das.yify.models

import androidx.annotation.StringDef
import io.github.kunal26das.yify.models.OrderBy.Companion.ORDER_BY_ASC
import io.github.kunal26das.yify.models.OrderBy.Companion.ORDER_BY_DESC

@StringDef(
    ORDER_BY_ASC,
    ORDER_BY_DESC,
)
annotation class OrderBy {
    companion object : ArrayList<String>() {

        const val ORDER_BY_ASC = "asc"
        const val ORDER_BY_DESC = "desc"

        init {
            add(ORDER_BY_ASC)
            add(ORDER_BY_DESC)
        }
    }
}