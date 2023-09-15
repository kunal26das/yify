package io.github.kunal26das.common.compose

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.systemBars
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.Dp

val statusBarHeight: Dp
    @Composable get() {
        val systemBarsPaddingValues = WindowInsets.systemBars.asPaddingValues()
        return systemBarsPaddingValues.calculateTopPadding()
    }