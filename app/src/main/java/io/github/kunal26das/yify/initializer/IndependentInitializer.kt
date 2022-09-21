package io.github.kunal26das.yify.initializer

import androidx.startup.Initializer

interface IndependentInitializer<T> : Initializer<T> {
    override fun dependencies() = mutableListOf<Class<out Initializer<*>>>()
}