package io.github.kunal26das.yify.coil

import io.github.kunal26das.yify.Yify

object YifyImageLoader : ImageLoaderBuilder(Yify.INSTANCE, {
    allowHardware(false)
})
