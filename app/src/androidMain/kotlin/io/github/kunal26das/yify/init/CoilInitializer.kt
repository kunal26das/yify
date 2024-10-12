package io.github.kunal26das.yify.init

import android.content.Context
import coil3.ImageLoader
import coil3.disk.DiskCache
import coil3.memory.MemoryCache
import coil3.request.CachePolicy
import coil3.util.DebugLogger
import io.github.kunal26das.yify.BuildConfig
import okio.Path.Companion.toOkioPath

class CoilInitializer : IndependentInitializer<ImageLoader>() {

    override fun create(context: Context): ImageLoader {
        val imageLoader = ImageLoader.Builder(context).apply {
            networkCachePolicy(CachePolicy.ENABLED)
            memoryCachePolicy(CachePolicy.ENABLED)
            memoryCache {
                MemoryCache.Builder().apply {
                    strongReferencesEnabled(true)
                    maxSizePercent(context, 0.2) // 20%
                }.build()
            }
            diskCachePolicy(CachePolicy.ENABLED)
            diskCache {
                DiskCache.Builder().apply {
                    directory(context.cacheDir.toOkioPath())
                    maxSizePercent(0.02) // 2%
                }.build()
            }
            if (BuildConfig.DEBUG) {
                logger(DebugLogger())
            }
//            respectCacheHeaders(false)
//            okHttpClient {
//                val builder = OkHttpClient.Builder()
//                builder.retryOnConnectionFailure(true)
//                val dns = getDns(builder)
//                builder.dns(dns).build()
//            }
        }.build()
        return imageLoader
    }
}