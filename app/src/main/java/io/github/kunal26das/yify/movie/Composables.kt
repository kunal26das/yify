package io.github.kunal26das.yify.movie

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.paging.PagingData
import androidx.paging.compose.collectAsLazyPagingItems
import coil.compose.AsyncImage
import com.google.accompanist.flowlayout.FlowRow
import com.google.accompanist.placeholder.PlaceholderHighlight
import com.google.accompanist.placeholder.fade
import com.google.accompanist.placeholder.placeholder
import com.google.accompanist.swiperefresh.SwipeRefresh
import com.google.accompanist.swiperefresh.rememberSwipeRefreshState
import io.github.kunal26das.model.Movie
import kotlinx.coroutines.flow.Flow

@OptIn(ExperimentalMaterial3Api::class)
interface Composables {

    @Composable
    fun Movies(
        modifier: Modifier = Modifier,
        source: Flow<PagingData<Movie>>? = null,
        onRefresh: () -> Unit = {},
        onClick: (Movie?) -> Unit = {},
    ) {
        val movies = source?.collectAsLazyPagingItems()
        SwipeRefresh(
            modifier = modifier,
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
        val shape = RoundedCornerShape(8.dp)
        var isLoaded by remember { mutableStateOf(false) }
        ElevatedCard(
            modifier = modifier.placeholder(
                visible = !isLoaded,
                color = Color.Gray,
                shape = shape,
                highlight = PlaceholderHighlight.fade(Color.Gray),
            ),
            shape = shape,
            onClick = { onClick.invoke(movie) },
        ) {
            AsyncImage(
                modifier = Modifier.fillMaxSize(),
                contentDescription = movie?.title,
                model = movie?.coverImage,
                onSuccess = { isLoaded = true }
            )
        }
    }

    @Composable
    fun FlowChips(
        modifier: Modifier = Modifier,
        chips: List<String>,
        selected: String? = null,
        onClick: ((String) -> Unit)? = null
    ) {
        FlowRow(
            modifier = modifier
        ) {
            chips.forEach {
                FilterChip(
                    modifier = Modifier.padding(4.dp),
                    label = { Text(text = it) },
                    selected = it == selected,
                    onClick = { onClick?.invoke(it) }
                )
            }
        }
    }

    @Composable
    fun Chips(
        modifier: Modifier = Modifier,
        chips: List<String>,
        selected: String? = null,
        onClick: ((String) -> Unit)? = null
    ) {
        Row(
            modifier = modifier
        ) {
            chips.forEach {
                FilterChip(
                    modifier = Modifier.padding(4.dp),
                    label = { Text(text = it) },
                    selected = it == selected,
                    onClick = { onClick?.invoke(it) }
                )
            }
        }
    }

}