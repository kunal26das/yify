package io.github.kunal26das.core.singleton

abstract class Singleton<T> {

    private var value: T? = null
    private val isInitialized get() = value != null

    @Synchronized
    fun get() = when {
        isInitialized -> value!!
        else -> initialize().also {
            value = it
        }
    }

    abstract fun initialize(): T

}