package io.github.kunal26das.yify.compose

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import io.github.kunal26das.common.compose.statusBarHeight

@Composable
fun SystemBarGradient(
    modifier: Modifier = Modifier,
    color: Color? = MaterialTheme.colorScheme.background,
    reverse: Boolean = false,
) {
    Box(
        modifier = modifier
            .height(statusBarHeight)
            .background(
                Brush.verticalGradient(
                    colorStops = arrayOf(
                        0f to (color ?: MaterialTheme.colorScheme.background),
                        1f to Color.Transparent
                    ),
                    startY = if (reverse) Float.POSITIVE_INFINITY else 0f,
                    endY = if (reverse) 0f else Float.POSITIVE_INFINITY,
                )
            )
    )
}