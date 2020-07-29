package io.github.kunal26das.yify.utils

import android.content.res.Resources
import android.util.TypedValue
import androidx.essentials.core.KoinComponent.inject
import kotlin.math.roundToInt

object Constants {

    private val resources: Resources by inject()

    const val PAGE_SIZE = 10

    private val Int.dp: Int
        get() = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            toFloat(), resources.displayMetrics
        ).roundToInt()

    var TOOLBAR_MARGIN_VERTICAL = 12.dp
    var TOOLBAR_MARGIN_HORIZONTAL = 24.dp

    val HEIGHT_STATUS_BAR = resources.getDimensionPixelSize(
        resources.getIdentifier(
            "status_bar_height",
            "dimen",
            "android"
        )
    )
}
