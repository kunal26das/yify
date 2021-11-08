package io.github.kunal26das.yify.models

fun interface OnChangeListener<T> {
    fun onChange(value: T?)
}