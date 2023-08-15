package io.github.kunal26das.yify.compose

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.kunal26das.yify.ui.NewMoviesViewModel

@Composable
fun NewMovies(
    newMoviesViewModel: NewMoviesViewModel = viewModel()
) {
    val source by newMoviesViewModel.movies.observeAsState()
    source?.let {
        Movies(
            modifier = Modifier
                .fillMaxSize(),
            source = it
        )
    }
}