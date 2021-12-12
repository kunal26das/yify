package io.github.kunal26das.core.model

fun interface OnClickListener<T> {
    fun onClick(item: T?)
}