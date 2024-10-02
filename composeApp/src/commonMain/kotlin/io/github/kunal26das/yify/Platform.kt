package io.github.kunal26das.yify

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform