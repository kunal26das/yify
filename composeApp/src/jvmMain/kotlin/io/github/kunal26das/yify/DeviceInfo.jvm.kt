package io.github.kunal26das.yify

import java.awt.Toolkit

actual fun screenWidth(): Int {
    return Toolkit.getDefaultToolkit().screenSize.width
}