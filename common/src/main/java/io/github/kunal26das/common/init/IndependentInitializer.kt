package io.github.kunal26das.common.init

import androidx.startup.Initializer

abstract class IndependentInitializer<T> : Initializer<T> {
    final override fun dependencies() = mutableListOf<Class<out Initializer<*>>>()
}