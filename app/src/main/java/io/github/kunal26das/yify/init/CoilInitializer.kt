package io.github.kunal26das.yify.init

import android.content.Context
import coil.Coil
import coil.ImageLoader
import coil.request.CachePolicy
import coil.util.DebugLogger
import io.github.kunal26das.yify.BuildConfig

class CoilInitializer : IndependentInitializer<ImageLoader>() {

    override fun create(context: Context): ImageLoader {
        return ImageLoader.Builder(context).apply {
            networkCachePolicy(CachePolicy.ENABLED)
            memoryCachePolicy(CachePolicy.ENABLED)
            diskCachePolicy(CachePolicy.ENABLED)
            respectCacheHeaders(false)
            allowHardware(false)
            if (BuildConfig.DEBUG) {
                logger(DebugLogger())
            }
        }.build().also {
            Coil.setImageLoader(it)
        }
    }
}