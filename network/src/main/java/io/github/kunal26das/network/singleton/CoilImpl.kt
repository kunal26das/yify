package io.github.kunal26das.network.singleton

import android.content.Context
import coil.ImageLoader

abstract class CoilImpl(
    context: Context, private val builder: (ImageLoader.Builder.() -> Unit)? = null
) : Singleton<ImageLoader>() {

    private val applicationContext = context.applicationContext

    override fun initialize(): ImageLoader {
        return ImageLoader.Builder(applicationContext).apply {
            builder?.invoke(this)
        }.build()
    }

}
