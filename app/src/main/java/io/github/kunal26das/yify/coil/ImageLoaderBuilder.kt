package io.github.kunal26das.yify.coil

import androidx.essentials.network.Builder
import coil.ImageLoader
import io.github.kunal26das.yify.initializer.KoinInitializer.Companion.ApplicationContext

abstract class ImageLoaderBuilder(
    private val builder: (ImageLoader.Builder.() -> Unit)? = null
) : Builder<ImageLoader>() {

    override fun initialize(): ImageLoader {
        return ImageLoader.Builder(ApplicationContext).apply {
            builder?.invoke(this)
        }.build()
    }

}
