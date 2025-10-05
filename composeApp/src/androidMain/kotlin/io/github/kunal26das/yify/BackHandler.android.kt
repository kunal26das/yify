package io.github.kunal26das.yify

import androidx.compose.runtime.Composable
import androidx.activity.compose.BackHandler as ActivityBackHandler

@Composable
actual fun BackHandler(
    enabled: Boolean,
    onBack: () -> Unit
) {
    ActivityBackHandler(enabled = enabled, onBack = onBack)
}
