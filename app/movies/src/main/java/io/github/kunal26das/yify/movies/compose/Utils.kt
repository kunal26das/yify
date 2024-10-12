package io.github.kunal26das.yify.movies.compose

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.systemBars
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImagePainter

internal val statusBarHeight: Dp
    @Composable get() {
        val systemBarsPaddingValues = WindowInsets.systemBars.asPaddingValues()
        val height = systemBarsPaddingValues.calculateTopPadding()
        return maxOf(height, 8.dp)
    }

internal val navigationBarHeight: Dp
    @Composable get() {
        val systemBarsPaddingValues = WindowInsets.navigationBars.asPaddingValues()
        val height = systemBarsPaddingValues.calculateTopPadding()
        return maxOf(height, 8.dp)
    }

internal val cornerRadius: Dp
    @Composable get() {
        val displayCutoutPaddingValues = WindowInsets.displayCutout.asPaddingValues()
        val radius = displayCutoutPaddingValues.calculateTopPadding()
        return maxOf(radius, 8.dp)
    }

val AsyncImagePainter.State.isLoading
    get() = this is AsyncImagePainter.State.Loading
