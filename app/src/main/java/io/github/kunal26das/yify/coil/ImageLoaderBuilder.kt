package io.github.kunal26das.yify.coil

import android.content.Context
import androidx.essentials.network.Builder
import coil.ImageLoader

abstract class ImageLoaderBuilder(
    context: Context, private val builder: (ImageLoader.Builder.() -> Unit)? = null
) : Builder<ImageLoader>() {

    private val applicationContext = context.applicationContext

    override fun initialize(): ImageLoader {
        return ImageLoader.Builder(applicationContext).apply {
            builder?.invoke(this)
        }.build()
    }

}
