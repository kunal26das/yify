package io.github.kunal26das.yify.singleton

import android.content.Context
import io.github.kunal26das.network.singleton.CoilImpl

class YifyCoil(context: Context) : CoilImpl(context, {
    allowHardware(true)
})
