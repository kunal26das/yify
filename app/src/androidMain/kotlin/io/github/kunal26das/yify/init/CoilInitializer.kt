package io.github.kunal26das.yify.init

import android.content.Context
import coil.Coil
import coil.ImageLoader
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.request.CachePolicy
import coil.util.DebugLogger
import io.github.kunal26das.yify.BuildConfig
import io.github.kunal26das.yify.di.getDns
import okhttp3.OkHttpClient

class CoilInitializer : IndependentInitializer<ImageLoader>() {

    override fun create(context: Context): ImageLoader {
        return ImageLoader.Builder(context).apply {
            networkCachePolicy(CachePolicy.ENABLED)
            memoryCachePolicy(CachePolicy.ENABLED)
            memoryCache {
                MemoryCache.Builder(context).apply {
                    strongReferencesEnabled(true)
                    maxSizePercent(0.2) // 20%
                }.build()
            }
            diskCachePolicy(CachePolicy.ENABLED)
            diskCache {
                DiskCache.Builder().apply {
                    directory(context.cacheDir)
                    maxSizePercent(0.02) // 2%
                }.build()
            }
            respectCacheHeaders(false)
            if (BuildConfig.DEBUG) {
                logger(DebugLogger())
            }
            okHttpClient {
                val builder = OkHttpClient.Builder()
                builder.retryOnConnectionFailure(true)
                val dns = getDns(builder)
                builder.dns(dns).build()
            }
        }.build().also {
            Coil.setImageLoader(it)
        }
    }
}