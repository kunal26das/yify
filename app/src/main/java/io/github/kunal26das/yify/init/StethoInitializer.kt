package io.github.kunal26das.yify.init

import android.content.Context
import com.facebook.stetho.Stetho
import io.github.kunal26das.common.init.IndependentInitializer

class StethoInitializer : IndependentInitializer<Any> {
    override fun create(context: Context): Any {
        return Stetho.initializeWithDefaults(context)
    }
}