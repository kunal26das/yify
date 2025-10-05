package io.github.kunal26das.yify

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import coil3.ImageLoader
import coil3.compose.LocalPlatformContext
import coil3.compose.setSingletonImageLoaderFactory
import coil3.memory.MemoryCache
import coil3.request.CachePolicy
import coil3.request.crossfade
import io.github.kunal26das.yify.movies.compose.LocalCornerRadius
import io.github.kunal26das.yify.movies.compose.LocalShimmer
import io.github.kunal26das.yify.movies.compose.Movies
import io.github.kunal26das.yify.movies.compose.Shimmer
import io.github.kunal26das.yify.movies.compose.cornerRadius
import org.jetbrains.compose.ui.tooling.preview.Preview

@Composable
@Preview
fun App() {
    val context = LocalPlatformContext.current
    setSingletonImageLoaderFactory {
        ImageLoader.Builder(context).apply {
            networkCachePolicy(CachePolicy.ENABLED)
            memoryCachePolicy(CachePolicy.ENABLED)
            diskCachePolicy(CachePolicy.ENABLED)
            crossfade(true)
            memoryCache {
                MemoryCache.Builder().apply {
                    strongReferencesEnabled(true)
                    maxSizePercent(context, 1.0)
                }.build()
            }
        }.build()
    }
    CompositionLocalProvider(
        LocalCornerRadius provides cornerRadius,
        LocalShimmer provides Shimmer.Companion.shimmer(),
    ) {
        Movies(modifier = Modifier.fillMaxSize())
    }
}