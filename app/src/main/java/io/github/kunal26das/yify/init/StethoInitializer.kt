package io.github.kunal26das.yify.init

import android.content.Context
import com.facebook.stetho.Stetho

class StethoInitializer : io.github.kunal26das.common.IndependentInitializer<Any> {
    override fun create(context: Context): Any {
        return Stetho.initializeWithDefaults(context)
    }
}