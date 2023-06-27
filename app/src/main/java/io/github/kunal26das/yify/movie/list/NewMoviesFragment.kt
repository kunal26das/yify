package io.github.kunal26das.yify.movie.list

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.fragment.app.viewModels
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class NewMoviesFragment : MovieListFragment() {

    override val viewModel by viewModels<NewMoviesViewModel>()

    @Preview
    @Composable
    override fun Content() {
        val source by viewModel.movies.observeAsState()
        Box(
            modifier = Modifier.fillMaxSize()
        ) {
            Movies(
                modifier = Modifier.fillMaxSize(),
                source = source,
                onRefresh = { viewModel.refresh() },
                onClick = { movieActivity.launch(it) }
            )
        }
    }

}