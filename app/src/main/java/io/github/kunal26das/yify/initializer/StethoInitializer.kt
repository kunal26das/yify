package io.github.kunal26das.yify.initializer

import android.content.Context
import com.facebook.stetho.Stetho

class StethoInitializer : IndependentInitializer<Any> {
    override fun create(context: Context): Any {
        return Stetho.initializeWithDefaults(context)
    }
}