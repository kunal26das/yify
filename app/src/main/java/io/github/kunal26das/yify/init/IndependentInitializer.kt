package io.github.kunal26das.yify.init

import androidx.startup.Initializer

abstract class IndependentInitializer<T> : Initializer<T> {
    final override fun dependencies() = mutableListOf<Class<out Initializer<*>>>()
}