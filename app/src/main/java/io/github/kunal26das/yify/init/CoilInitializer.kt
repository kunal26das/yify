package io.github.kunal26das.yify.init

import android.content.Context
import coil.Coil
import coil.ImageLoader
import io.github.kunal26das.common.init.IndependentInitializer

class CoilInitializer : IndependentInitializer<Coil> {
    override fun create(context: Context): Coil {
        val builder = ImageLoader.Builder(context)
        Coil.setImageLoader(builder.build())
        return Coil
    }
}