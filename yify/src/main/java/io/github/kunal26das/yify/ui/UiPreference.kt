package io.github.kunal26das.yify.ui

import kotlinx.serialization.Serializable

@Serializable
data class UiPreference constructor(
    val preview: Preview,
) {
    companion object {
        val Uncategorised = UiPreference(
            preview = Preview.Uncategorised,
        )
    }
}