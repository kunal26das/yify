package io.github.kunal26das.yify.movie.list

import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.essentials.view.ComposeActivity
import androidx.paging.compose.collectAsLazyPagingItems
import coil.compose.AsyncImage
import com.google.accompanist.swiperefresh.SwipeRefresh
import com.google.accompanist.swiperefresh.rememberSwipeRefreshState
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.model.Movie
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.movie.filter.MovieFilterFragment
import io.github.kunal26das.yify.movie.profile.MovieActivity

@AndroidEntryPoint
@OptIn(ExperimentalMaterial3Api::class)
class MovieListActivity : ComposeActivity() {

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
        val isRefreshing by remember { mutableStateOf(false) }
        SwipeRefresh(
            modifier = Modifier.fillMaxSize(),
            state = rememberSwipeRefreshState(isRefreshing),
            onRefresh = { viewModel.refresh() },
        ) {
            Box(
                modifier = Modifier.fillMaxSize(),
            ) {
                when (movies?.itemCount) {
                    null, 0 -> CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center),
                    )
                    else -> LazyVerticalGrid(
                        modifier = Modifier.fillMaxSize(),
                        columns = GridCells.Fixed(columns ?: 2),
                        content = {
                            items(movies.itemCount) { index ->
                                Movie(movie = movies[index])
                            }
                        }
                    )
                }
                FilterButton(
                    modifier = Modifier.align(Alignment.BottomEnd)
                )
            }
        }
    }

    @Composable
    private fun Movie(movie: Movie?) {
        ElevatedCard(
            modifier = Modifier.padding(8.dp),
            onClick = { movieActivity.launch(movie) }
        ) {
            AsyncImage(
                modifier = Modifier.fillMaxSize(),
                contentDescription = null,
                model = movie?.coverImage,
            )
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
                }.showNow(supportFragmentManager, null)
            },
            icon = {},
        )
    }

}
