package io.github.kunal26das.yify.compose

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.kunal26das.yify.ui.AllMoviesViewModel

@Composable
fun AllMovies(
    allMoviesViewModel: AllMoviesViewModel = viewModel(),
) {
    val source by allMoviesViewModel.movies.observeAsState()
    source?.let {
        Movies(
            modifier = Modifier
                .fillMaxSize(),
            source = it,
        )
    }
}