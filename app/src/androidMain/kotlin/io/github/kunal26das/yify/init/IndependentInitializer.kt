package io.github.kunal26das.yify.init

import androidx.startup.Initializer

sealed class IndependentInitializer<T> : Initializer<T> {
    final override fun dependencies() = listOf<Class<out Initializer<*>>>()
}