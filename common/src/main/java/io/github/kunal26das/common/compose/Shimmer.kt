package io.github.kunal26das.common.compose

import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.IntSize

private const val OFFSET = 4

fun Modifier.shimmer(
    label: String,
    duration: Int = 1500,
    enabled: Boolean = true,
): Modifier = composed {
    if (enabled.not()) return@composed this
    var size by remember { mutableStateOf(IntSize.Zero) }
    val transition = rememberInfiniteTransition(label = label)
    val startOffsetX by transition.animateFloat(
        initialValue = -OFFSET * size.width.toFloat(),
        targetValue = OFFSET * size.width.toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(duration)
        ),
        label = label,
    )
    background(
        brush = Brush.linearGradient(
            colors = listOf(
                MaterialTheme.colorScheme.onPrimary,
                MaterialTheme.colorScheme.primary,
                MaterialTheme.colorScheme.onPrimary,
            ),
            start = Offset(startOffsetX, 0f),
            end = Offset(startOffsetX + size.width.toFloat(), size.height.toFloat())
        )
    ).onGloballyPositioned {
        size = it.size
    }
}