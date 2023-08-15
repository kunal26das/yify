package io.github.kunal26das.common

import androidx.startup.Initializer

interface IndependentInitializer<T> : Initializer<T> {
    override fun dependencies() = mutableListOf<Class<out Initializer<*>>>()
}