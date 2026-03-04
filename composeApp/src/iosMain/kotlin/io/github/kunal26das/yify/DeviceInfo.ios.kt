package io.github.kunal26das.yify

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.useContents
import platform.UIKit.UIScreen

@OptIn(ExperimentalForeignApi::class)
actual fun screenWidth(): Int {
    return UIScreen.mainScreen.bounds.useContents { size.width.toInt() }
}