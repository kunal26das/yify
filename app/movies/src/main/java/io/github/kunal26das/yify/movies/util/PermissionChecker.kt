package io.github.kunal26das.yify.movies.util

import android.content.Context
import androidx.core.content.PermissionChecker

fun Context.hasPermission(permission: String): Boolean {
    return PermissionChecker.checkSelfPermission(
        this,
        permission
    ) == PermissionChecker.PERMISSION_GRANTED
}