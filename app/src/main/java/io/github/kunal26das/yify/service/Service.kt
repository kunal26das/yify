package io.github.kunal26das.yify.service

fun interface Service<T> {
    fun get(): T
}