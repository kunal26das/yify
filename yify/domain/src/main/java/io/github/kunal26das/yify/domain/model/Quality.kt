package io.github.kunal26das.yify.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class Quality {
    Low, Medium, High, Unknown,
}