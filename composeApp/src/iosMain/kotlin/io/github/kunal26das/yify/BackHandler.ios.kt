package io.github.kunal26das.yify

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect

@Composable
actual fun BackHandler(
    enabled: Boolean,
    onBack: () -> Unit
) {
    LaunchedEffect(enabled) {
        if (enabled) onBack.invoke()
    }
}
