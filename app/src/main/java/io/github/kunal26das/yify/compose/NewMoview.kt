package io.github.kunal26das.yify.compose

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.kunal26das.yify.movie.list.NewMoviesViewModel
import io.github.kunal26das.yify.movie.profile.MovieActivity

@Composable
fun NewMovies(
    newMoviesViewModel: NewMoviesViewModel = viewModel()
) {
    val source by newMoviesViewModel.movies.observeAsState()
    val movieActivity = rememberLauncherForActivityResult(MovieActivity.Contract()) {}
    Box(
        modifier = Modifier.fillMaxSize()
    ) {
        Movies(
            modifier = Modifier.fillMaxSize(),
            source = source
        ) { movieActivity.launch(it) }
    }
}