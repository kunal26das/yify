package io.github.kunal26das.yify.movies.compose

import android.annotation.SuppressLint
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.collectAsState
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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update

typealias ShimmerAnimation = State<Float>

class Shimmer private constructor(
    private val size: MutableStateFlow<IntSize>,
    private val animation: ShimmerAnimation,
) {

    fun setSize(size: IntSize) {
        this.size.update { size }
    }

    @Composable
    fun animation(): ShimmerAnimation {
        return animation
    }

    companion object {

        private const val SHIMMER_LABEL = "shimmer"
        private const val SHIMMER_DURATION = 1000
        private const val SHIMMER_OFFSET = 4

        @SuppressLint("ComposableNaming")
        @Composable
        internal fun shimmer(
            duration: Int = SHIMMER_DURATION,
            label: String = SHIMMER_LABEL,
            offset: Int = SHIMMER_OFFSET,
        ): Shimmer {
            val mutableSize = MutableStateFlow(IntSize.Zero)
            val size by mutableSize.collectAsState()
            val infiniteTransition = rememberInfiniteTransition(label)
            return Shimmer(
                size = mutableSize,
                animation = infiniteTransition.animateFloat(
                    initialValue = -offset * size.width.toFloat(),
                    targetValue = offset * size.width.toFloat(),
                    animationSpec = infiniteRepeatable(
                        animation = tween(duration)
                    ),
                    label = label,
                )
            )
        }
    }
}

fun Modifier.yifyShimmer(
    enabled: Boolean = true,
): Modifier = composed {
    if (enabled.not()) return@composed this
    val shimmer = LocalShimmer.current
    val animation by shimmer.animation()
    var size by remember { mutableStateOf(IntSize.Zero) }
    background(
        brush = Brush.linearGradient(
            colors = listOf(
                MaterialTheme.colorScheme.onPrimary,
                MaterialTheme.colorScheme.primary,
                MaterialTheme.colorScheme.onPrimary,
            ),
            start = Offset(animation, 0f),
            end = Offset(animation + size.width.toFloat(), size.height.toFloat())
        ),
    ).onGloballyPositioned {
        size = it.size
        shimmer.setSize(it.size)
    }
}