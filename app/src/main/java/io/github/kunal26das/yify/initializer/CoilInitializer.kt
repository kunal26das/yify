package io.github.kunal26das.yify.initializer

import android.content.Context
import coil.Coil
import coil.ImageLoader

class CoilInitializer : IndependentInitializer<Coil> {
    override fun create(context: Context): Coil {
        val builder = ImageLoader.Builder(context)
        Coil.setImageLoader(builder.build())
        return Coil
    }
}