package io.github.kunal26das.yify.movie.home

import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.ui.graphics.vector.ImageVector
import io.github.kunal26das.yify.R

sealed class Destination(
    @StringRes val stringResId: Int,
    val icon: ImageVector,
) {

    object RecentlyAdded : Destination(
        R.string.recently_added,
        Icons.Default.Star,
    )

    object AllMovies : Destination(
        R.string.all,
        Icons.Default.Movie,
    )

    object Settings : Destination(
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
