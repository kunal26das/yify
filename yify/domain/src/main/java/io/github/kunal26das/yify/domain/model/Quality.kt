package io.github.kunal26das.yify.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class Quality(val value: Int) {
    Unknown(-1), Low(0), Medium(1), High(2),
    ;

    companion object {
        operator fun get(quality: Int?): Quality? {
            return Quality.values().find { it.value == quality }
        }
    }
}