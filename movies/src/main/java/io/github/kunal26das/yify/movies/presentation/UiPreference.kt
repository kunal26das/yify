package io.github.kunal26das.yify.movies.presentation

import kotlinx.serialization.Serializable

@Serializable
data class UiPreference constructor(
    val preview: Preview? = null,
) {
    companion object {
        val Uncategorised
            get() = UiPreference(
                preview = Preview.Uncategorised,
            )
    }
}