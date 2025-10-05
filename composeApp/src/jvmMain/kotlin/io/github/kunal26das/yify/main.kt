package io.github.kunal26das.yify

import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application

fun main() = application {
    initKoin {
        modules(networkModule)
    }
    Window(
        onCloseRequest = ::exitApplication,
        title = "Yify",
    ) {
        App()
    }
}