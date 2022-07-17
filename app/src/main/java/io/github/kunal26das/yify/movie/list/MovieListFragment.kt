package io.github.kunal26das.yify.movie.list

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.essentials.view.ComposeFragment
import androidx.fragment.app.viewModels
import androidx.paging.compose.collectAsLazyPagingItems
import com.google.accompanist.swiperefresh.SwipeRefresh
import com.google.accompanist.swiperefresh.rememberSwipeRefreshState
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.movie.Composables
import io.github.kunal26das.yify.movie.filter.MovieFilterFragment
import io.github.kunal26das.yify.movie.profile.MovieActivity

@AndroidEntryPoint
class MovieListFragment : ComposeFragment(), Composables {

    private val viewModel by viewModels<MovieListViewModel>()
    private val movieActivity = registerForActivityResult(MovieActivity.Contract())

    @Preview
    @Composable
    override fun setContent() {
        super.setContent()
        Movies()
    }

    @Composable
    private fun Movies() {
        val source by viewModel.movies.observeAsState()
        val movies = source?.collectAsLazyPagingItems()
        val columns by viewModel.columns.observeAsState()
        SwipeRefresh(
            modifier = Modifier.fillMaxSize(),
            state = rememberSwipeRefreshState(
                isRefreshing = movies != null && movies.itemCount == 0
            ),
            onRefresh = { viewModel.refresh() },
        ) {
            Box(
                modifier = Modifier.fillMaxSize(),
            ) {
                LazyVerticalGrid(
                    modifier = Modifier.fillMaxSize(),
                    columns = GridCells.Fixed(columns ?: 2),
                    content = {
                        items(movies?.itemCount ?: 0) { index ->
                            val movie = movies?.get(index)
                            MovieCard(
                                modifier = Modifier.padding(8.dp),
                                movie = movie,
                            ) {
                                movieActivity.launch(movie)
                            }
                        }
                    }
                )
                FilterButton(
                    modifier = Modifier.align(Alignment.BottomEnd)
                )
            }
        }
    }

    @Composable
    private fun FilterButton(modifier: Modifier) {
        ExtendedFloatingActionButton(
            modifier = modifier.padding(16.dp),
            text = { Text(text = getString(R.string.filter)) },
            onClick = {
                viewModel.page.value = null
                MovieFilterFragment().setOnFiltersChangeListener {
                    viewModel.refresh(1000L)
                }.showNow(childFragmentManager, null)
            },
            icon = {},
        )
    }

}
