package io.github.kunal26das.yify.compose

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import io.github.kunal26das.common.download
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.model.MoviePreference

@Composable
fun Home(
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val moviePreference = MoviePreference.Latest4K
    var openDialog by remember { mutableStateOf(false) }
    var movie by remember { mutableStateOf<Movie?>(null) }
    Movies(
        modifier = modifier,
        moviePreference = moviePreference
    ) {
        context.download(it?.torrents?.firstOrNull {
            it.quality == moviePreference.quality
        }?.url)
//        movie = it
//        openDialog = true
    }
    if (openDialog) {
        MovieDialog(movie = movie) {
            openDialog = false
            movie = null
        }
    }
}