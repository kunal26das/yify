package io.github.kunal26das.yify.ui

import kotlinx.serialization.Serializable

@Serializable
data class UiPreference constructor(
    val ui: UserInterface,
) {
    companion object {
        val Uncategorised = UiPreference(
            ui = UserInterface.Uncategorised
        )
    }
}