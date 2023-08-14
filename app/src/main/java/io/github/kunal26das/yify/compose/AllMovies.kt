package io.github.kunal26das.yify.compose

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FilterAlt
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentManager
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.movie.filter.MovieFilterFragment
import io.github.kunal26das.yify.movie.list.AllMoviesViewModel
import io.github.kunal26das.yify.movie.profile.MovieActivity

@Composable
fun AllMovies(
    allMoviesViewModel: AllMoviesViewModel = viewModel(),
    childFragmentManager: FragmentManager,
) {
    val source by allMoviesViewModel.movies.observeAsState()
    val movieActivity = rememberLauncherForActivityResult(MovieActivity.Contract()) {}
    Box(
        modifier = Modifier.fillMaxSize()
    ) {
        Movies(
            modifier = Modifier.fillMaxSize(),
            source = source
        ) { movieActivity.launch(it) }
        ExtendedFloatingActionButton(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp),
            text = { Text(text = stringResource(R.string.filter)) },
            icon = { Icon(Icons.Default.FilterAlt, null) },
            onClick = {
                MovieFilterFragment().setOnFiltersChangeListener {
                    allMoviesViewModel.refresh(1000L)
                }.showNow(childFragmentManager, null)
            },
        )
    }
}