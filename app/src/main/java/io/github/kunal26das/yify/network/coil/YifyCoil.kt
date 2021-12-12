package io.github.kunal26das.yify.network.coil

import android.content.Context

class YifyCoil(context: Context) : CoilImpl(context, {
    allowHardware(true)
})
