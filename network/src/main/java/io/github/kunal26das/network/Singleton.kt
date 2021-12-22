package io.github.kunal26das.network

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

    internal abstract fun initialize(): T

}