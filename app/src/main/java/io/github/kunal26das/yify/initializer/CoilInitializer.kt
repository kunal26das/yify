package io.github.kunal26das.yify.initializer

import android.content.Context
import coil.Coil
import io.github.kunal26das.yify.coil.YifyImageLoader

class CoilInitializer : IndependentInitializer<Coil> {
    override fun create(context: Context): Coil {
        Coil.setImageLoader(YifyImageLoader.INSTANCE)
        return Coil
    }
}