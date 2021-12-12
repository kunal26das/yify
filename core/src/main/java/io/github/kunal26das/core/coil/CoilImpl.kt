package io.github.kunal26das.core.coil

import android.content.Context
import coil.ImageLoader
import io.github.kunal26das.core.singleton.Singleton

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
