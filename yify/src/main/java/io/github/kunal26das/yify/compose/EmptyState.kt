package io.github.kunal26das.yify.compose

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material.Text
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.paging.LoadState
import androidx.paging.compose.LazyPagingItems
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.domain.model.Movie

@Composable
fun EmptyState(
    modifier: Modifier = Modifier,
    movies: LazyPagingItems<Movie>,
    onRefresh: () -> Unit = {},
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = when (movies.loadState.refresh) {
                is LoadState.Error -> {
                    val error = (movies.loadState.refresh as LoadState.Error)
                    error.error.message.toString()
                }

                else -> stringResource(R.string.no_movies_found)
            },
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurface,
            fontSize = 20.sp,
        )

        OutlinedButton(
            modifier = Modifier.padding(top = 12.dp),
            onClick = onRefresh,
            content = {
                Text(
                    text = stringResource(R.string.refresh),
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        )
    }
}