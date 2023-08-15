package io.github.kunal26das.yify

import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Destination(
    @StringRes val stringResId: Int,
    val icon: ImageVector,
) {

    data object RecentlyAdded : Destination(
        R.string.recently_added,
        Icons.Default.Star,
    )

    data object AllMovies : Destination(
        R.string.all,
        Icons.Default.Movie,
    )

    data object Settings : Destination(
        R.string.settings,
        Icons.Default.Settings,
    )

    companion object : ArrayList<Destination>() {
        init {
            add(RecentlyAdded)
            add(AllMovies)
//            add(Settings)
        }
    }
}
