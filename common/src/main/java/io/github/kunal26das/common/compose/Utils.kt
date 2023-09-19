package io.github.kunal26das.common.compose

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.systemBars
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

val statusBarHeight: Dp
    @Composable get() {
        val systemBarsPaddingValues = WindowInsets.systemBars.asPaddingValues()
        val height = systemBarsPaddingValues.calculateTopPadding()
        return if (height > 8.dp) systemBarsPaddingValues.calculateTopPadding() else 8.dp
    }