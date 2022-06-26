package io.github.kunal26das.yify.coil

import android.content.Context

class YifyImageLoader(context: Context) : ImageLoaderBuilder(context, {
    allowHardware(false)
})
