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
import io.github.kunal26das.yify.movies.compose.LocalCornerRadius
import io.github.kunal26das.yify.movies.compose.LocalNavigationBarHeight
import io.github.kunal26das.yify.movies.compose.LocalShimmer
import io.github.kunal26das.yify.movies.compose.LocalStatusBarHeight
import io.github.kunal26das.yify.movies.compose.Movies
import io.github.kunal26das.yify.movies.compose.Shimmer
import io.github.kunal26das.yify.movies.compose.cornerRadius
import io.github.kunal26das.yify.movies.compose.navigationBarHeight
import io.github.kunal26das.yify.movies.compose.statusBarHeight
import org.jetbrains.compose.ui.tooling.preview.Preview

@Composable
@Preview
fun App() {
    val context = LocalPlatformContext.current
    setSingletonImageLoaderFactory {
        ImageLoader.Builder(context).apply {
            networkCachePolicy(CachePolicy.ENABLED)
            memoryCachePolicy(CachePolicy.ENABLED)
            memoryCache {
                MemoryCache.Builder().apply {
                    strongReferencesEnabled(true)
                    maxSizePercent(context, 0.2) // 20%
                }.build()
            }
            diskCachePolicy(CachePolicy.ENABLED)
//            diskCache {
//                DiskCache.Builder().apply {
//                    directory(context.cacheDir)
//                    maxSizePercent(0.02) // 2%
//                }.build()
//            }
//            respectCacheHeaders(false)
//            okHttpClient {
//                val builder = OkHttpClient.Builder()
//                builder.retryOnConnectionFailure(true)
//                val dns = getDns(builder)
//                builder.dns(dns).build()
//            }
        }.build()
    }
    CompositionLocalProvider(
        LocalShimmer provides Shimmer.Companion.shimmer(),
        LocalCornerRadius provides cornerRadius,
        LocalStatusBarHeight provides statusBarHeight,
        LocalNavigationBarHeight provides navigationBarHeight,
    ) {
        Movies(modifier = Modifier.fillMaxSize())
    }
}