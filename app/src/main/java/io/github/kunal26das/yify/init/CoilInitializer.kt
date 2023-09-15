package io.github.kunal26das.yify.init

import android.content.Context
import coil.Coil
import coil.ImageLoader
import coil.request.CachePolicy
import io.github.kunal26das.common.init.IndependentInitializer
import okhttp3.OkHttpClient
import javax.inject.Inject

class CoilInitializer : IndependentInitializer<ImageLoader>() {

    @Inject
    lateinit var okHttpClient: OkHttpClient

    override fun create(context: Context): ImageLoader {
        InitializerEntryPoint.resolve(context).inject(this)
        return ImageLoader.Builder(context).apply {
            networkCachePolicy(CachePolicy.ENABLED)
            memoryCachePolicy(CachePolicy.ENABLED)
            diskCachePolicy(CachePolicy.ENABLED)
            respectCacheHeaders(false)
            okHttpClient(okHttpClient)
            allowHardware(false)
        }.build().also {
            Coil.setImageLoader(it)
        }
    }
}