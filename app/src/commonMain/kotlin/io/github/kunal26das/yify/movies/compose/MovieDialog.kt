package io.github.kunal26das.yify.movies.compose

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.kunal26das.yify.movies.domain.model.Movie
import io.github.kunal26das.yify.movies.domain.model.Torrent

@Composable
fun MovieDialog(
    modifier: Modifier = Modifier,
    movie: Movie,
) {
    Column(
        modifier = modifier.statusBarsPadding()
    ) {
        TrailerCard(
            modifier = Modifier.padding(0.dp),
            movie = movie,
        )
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = 8.dp,
                bottom = LocalStatusBarHeight.current
            ),
            content = {
                item {
                    Title(
                        modifier = Modifier.padding(
                            horizontal = 16.dp,
                            vertical = 4.dp,
                        ),
                        movie = movie,
                    )
                }
                item {
                    Props(
                        modifier = Modifier.padding(
                            horizontal = 16.dp,
                            vertical = 4.dp,
                        ),
                        movie = movie,
                    )
                }
                if (movie.genres.isNotEmpty()) {
                    item {
                        Genre(
                            modifier = Modifier.padding(
                                vertical = 4.dp,
                            ),
                            movie = movie,
                        )
                    }
                }
                if (movie.description.isNotEmpty()) {
                    item {
                        Description(
                            modifier = Modifier.padding(
                                horizontal = 16.dp,
                                vertical = 4.dp,
                            ),
                            movie = movie,
                        )
                    }
                }
            },
        )
    }
}

@Composable
private fun Title(
    modifier: Modifier = Modifier,
    movie: Movie,
) {
    Text(
        modifier = modifier,
        text = movie.title,
        color = MaterialTheme.colorScheme.onSurface,
        overflow = TextOverflow.Ellipsis,
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        maxLines = 2,
    )
}

@Composable
private fun Props(
    modifier: Modifier = Modifier,
    movie: Movie,
) {
    val props = movie.run { listOf(rating, year, language) }
    Text(
        modifier = modifier,
        text = props.joinToString(" • ") { "$it" },
        color = MaterialTheme.colorScheme.onSurface,
        overflow = TextOverflow.Ellipsis,
        fontSize = 12.sp,
        maxLines = 1,
    )
}

@Composable
private fun Genre(
    modifier: Modifier = Modifier,
    movie: Movie,
) {
    LazyRow(
        modifier = modifier,
        contentPadding = PaddingValues(horizontal = 12.dp),
        content = {
            items(movie.genres) { genre ->
                SuggestionChip(
                    modifier = Modifier.padding(horizontal = 4.dp),
                    shape = RoundedCornerShape(16.dp),
                    onClick = {},
                    label = {
                        Text(
                            text = genre.name,
                            color = MaterialTheme.colorScheme.onSurface,
                            fontSize = 12.sp,
                            maxLines = 1,
                        )
                    },
                )
            }
        }
    )
}

@Composable
private fun Description(
    modifier: Modifier = Modifier,
    movie: Movie,
) {
    var maxLines by remember { mutableIntStateOf(Int.MAX_VALUE) }
    Text(
        modifier = modifier.clickable(
            interactionSource = remember {
                MutableInteractionSource()
            },
            indication = null,
        ) {
            maxLines = when (maxLines) {
                Int.MAX_VALUE -> Int.MAX_VALUE
                else -> Int.MAX_VALUE
            }
        },
        color = MaterialTheme.colorScheme.onSurface,
        overflow = TextOverflow.Ellipsis,
        text = movie.description,
        maxLines = maxLines,
        fontSize = 14.sp,
    )
}

@Composable
private fun Torrent(
    modifier: Modifier = Modifier,
    torrent: Torrent
) {
    OutlinedCard(
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
        ) {
            Text(
                text = "${torrent.quality?.name.orEmpty()} Quality (${torrent.type})",
                color = MaterialTheme.colorScheme.onSurface,
                overflow = TextOverflow.Clip,
                fontSize = 14.sp,
                maxLines = 1,
            )
            Text(
                color = MaterialTheme.colorScheme.onSurface,
                text = torrent.size,
                fontSize = 12.sp,
            )
        }
    }
}