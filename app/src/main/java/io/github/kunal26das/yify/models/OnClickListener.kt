package io.github.kunal26das.yify.models

fun interface OnClickListener<T> {
    fun onClick(item: T?)
}