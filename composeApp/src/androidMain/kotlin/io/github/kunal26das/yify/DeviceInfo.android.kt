package io.github.kunal26das.yify

import android.content.res.Resources

actual fun screenWidth(): Int {
    return Resources.getSystem().displayMetrics.widthPixels
}