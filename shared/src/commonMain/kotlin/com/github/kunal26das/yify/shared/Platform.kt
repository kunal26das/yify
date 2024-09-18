package com.github.kunal26das.yify.shared

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform