package io.github.kunal26das.core.model

fun interface OnChangeListener<T> {
    fun onChange(value: T?)
}