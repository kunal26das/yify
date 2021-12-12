package io.github.kunal26das.yify.network.coil

import android.content.Context
import coil.ImageLoader
import io.github.kunal26das.yify.service.Service

abstract class CoilImpl(
    context: Context, private val builder: (ImageLoader.Builder.() -> Unit)? = null
) : Service<ImageLoader> {

    private val applicationContext = context.applicationContext

    override fun get(): ImageLoader {
        return ImageLoader.Builder(applicationContext).apply {
            builder?.invoke(this)
        }.build()
    }

}
