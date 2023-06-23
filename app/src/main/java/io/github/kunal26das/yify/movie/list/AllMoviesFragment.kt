package io.github.kunal26das.yify.movie.list

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
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.fragment.app.viewModels
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.movie.Composables
import io.github.kunal26das.yify.movie.filter.MovieFilterFragment

@AndroidEntryPoint
class AllMoviesFragment : MovieListFragment(), Composables {

    override val viewModel by viewModels<AllMoviesViewModel>()

    @Preview
    @Composable
    override fun setContent() {
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
            FilterButton(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(16.dp)
            )
        }
    }

    @Composable
    private fun FilterButton(
        modifier: Modifier = Modifier
    ) {
        ExtendedFloatingActionButton(
            modifier = modifier,
            text = { Text(text = getString(R.string.filter)) },
            icon = { Icon(Icons.Default.FilterAlt, null) },
            onClick = {
                MovieFilterFragment().setOnFiltersChangeListener {
                    viewModel.refresh(1000L)
                }.showNow(childFragmentManager, null)
            },
        )
    }

}
