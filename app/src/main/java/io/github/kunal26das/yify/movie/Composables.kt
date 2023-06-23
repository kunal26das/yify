package io.github.kunal26das.yify.movie

import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.paging.PagingData
import androidx.paging.compose.collectAsLazyPagingItems
import coil.compose.AsyncImage
import io.github.kunal26das.model.Movie
import kotlinx.coroutines.flow.Flow

@OptIn(ExperimentalMaterial3Api::class)
interface Composables {

    @OptIn(ExperimentalMaterialApi::class)
    @Composable
    fun Movies(
        modifier: Modifier = Modifier,
        source: Flow<PagingData<Movie>>? = null,
        onRefresh: () -> Unit = {},
        onClick: (Movie?) -> Unit = {},
    ) {
        val movies = source?.collectAsLazyPagingItems()
        val refreshing: () -> Boolean = { movies != null && movies.itemCount == 0 }
        val pullRefreshState = rememberPullRefreshState(
            refreshing = refreshing.invoke(),
            onRefresh = onRefresh,
        )
//        PullRefreshIndicator(
//            modifier = modifier,
//            state = pullRefreshState,
//            refreshing = refreshing.invoke()
//        )
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

    @Composable
    fun MovieCard(
        modifier: Modifier = Modifier,
        movie: Movie?,
        onClick: (Movie?) -> Unit = {},
    ) {
        val shape = RoundedCornerShape(8.dp)
        ElevatedCard(
            modifier = modifier,
            shape = shape,
            onClick = { onClick.invoke(movie) },
        ) {
            AsyncImage(
                modifier = Modifier.fillMaxSize(),
                contentDescription = movie?.title,
                model = movie?.coverImage,
            )
        }
    }

    @OptIn(ExperimentalLayoutApi::class)
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