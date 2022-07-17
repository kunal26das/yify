package io.github.kunal26das.yify.movie

import android.view.View
import android.view.ViewGroup
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.fragment.app.FragmentContainerView
import androidx.fragment.app.FragmentManager
import androidx.fragment.app.FragmentTransaction
import androidx.fragment.app.commit
import androidx.paging.PagingData
import androidx.paging.compose.collectAsLazyPagingItems
import coil.compose.AsyncImage
import com.google.accompanist.swiperefresh.SwipeRefresh
import com.google.accompanist.swiperefresh.rememberSwipeRefreshState
import io.github.kunal26das.model.Movie
import kotlinx.coroutines.flow.Flow

@OptIn(ExperimentalMaterial3Api::class)
interface Composables {

    @Composable
    fun FragmentContainer(
        modifier: Modifier = Modifier,
        fragmentManager: FragmentManager,
        commit: FragmentTransaction.(containerId: Int) -> Unit
    ) {
        val containerId by remember { mutableStateOf(View.generateViewId()) }
        AndroidView(
            modifier = modifier,
            factory = { context ->
                fragmentManager.findFragmentById(containerId)?.view
                    ?.also { (it.parent as? ViewGroup)?.removeView(it) }
                    ?: FragmentContainerView(context)
                        .apply { id = containerId }
                        .also {
                            fragmentManager.commit { commit(it.id) }
                        }
            }
        )
    }

    @Composable
    fun Movies(
        modifier: Modifier = Modifier,
        source: Flow<PagingData<Movie>>? = null,
        onRefresh: () -> Unit = {},
        onClick: (Movie?) -> Unit = {},
    ) {
        val movies = source?.collectAsLazyPagingItems()
        SwipeRefresh(
            modifier = Modifier,
            state = rememberSwipeRefreshState(
                isRefreshing = movies != null && movies.itemCount == 0
            ),
            onRefresh = onRefresh,
        ) {
            LazyVerticalGrid(
                modifier = Modifier.fillMaxSize(),
                columns = GridCells.Fixed(2),
                content = {
                    items(movies?.itemCount ?: 0) { index ->
                        val movie = movies?.get(index)
                        MovieCard(
                            modifier = Modifier.padding(8.dp),
                            movie = movie,
                            onClick = onClick,
                        )
                    }
                }
            )
        }
    }

    @Composable
    fun MovieCard(
        modifier: Modifier = Modifier,
        movie: Movie?,
        onClick: (Movie?) -> Unit = {},
    ) {
        ElevatedCard(
            modifier = modifier,
            onClick = { onClick.invoke(movie) },
        ) {
            AsyncImage(
                modifier = Modifier.fillMaxSize(),
                contentDescription = movie?.title,
                model = movie?.coverImage,
            )
        }
    }

}