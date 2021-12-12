package io.github.kunal26das.yify.singleton

import android.content.Context
import io.github.kunal26das.core.coil.CoilImpl

class YifyCoil(context: Context) : CoilImpl(context, {
    allowHardware(true)
})