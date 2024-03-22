package io.github.kunal26das.yify.movies.compose

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import coil.request.ImageRequest

val String.imageRequest: ImageRequest
    @Composable get() {
        return ImageRequest.Builder(LocalContext.current).also {
            it.placeholderMemoryCacheKey(this)
            it.memoryCacheKey(this)
            it.diskCacheKey(this)
            it.data(this)
        }.build()
    }