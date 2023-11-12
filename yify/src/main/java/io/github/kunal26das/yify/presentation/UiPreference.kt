package io.github.kunal26das.yify.presentation

import kotlinx.serialization.Serializable

@Serializable
data class UiPreference constructor(
    val preview: Preview? = null,
) {
    companion object {
        val Uncategorised = UiPreference(
            preview = Preview.Uncategorised,
        )
    }
}