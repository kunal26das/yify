package io.github.kunal26das.common.compose

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.systemBars
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImagePainter

val statusBarHeight: Dp
    @Composable get() {
        val systemBarsPaddingValues = WindowInsets.systemBars.asPaddingValues()
        val height = systemBarsPaddingValues.calculateTopPadding()
        return if (height > 8.dp) height else 8.dp
    }

val navigationBarHeight: Dp
    @Composable get() {
        val systemBarsPaddingValues = WindowInsets.navigationBars.asPaddingValues()
        val height = systemBarsPaddingValues.calculateTopPadding()
        return if (height > 8.dp) height else 8.dp
    }

val AsyncImagePainter.State.isLoading
    get() = this is AsyncImagePainter.State.Loading