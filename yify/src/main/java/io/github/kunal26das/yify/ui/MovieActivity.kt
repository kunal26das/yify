package io.github.kunal26das.yify.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.paint
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.graphics.drawable.toBitmap
import androidx.palette.graphics.Palette
import coil.compose.AsyncImagePainter
import coil.compose.rememberAsyncImagePainter
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.common.compose.statusBarHeight
import io.github.kunal26das.common.core.Activity
import io.github.kunal26das.yify.compose.TrailerCard
import io.github.kunal26das.yify.compose.imageRequest
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.Torrent

@AndroidEntryPoint
class MovieActivity : Activity() {

    private val viewModel by viewModels<MovieViewModel>()

    private val movieId get() = intent.getIntExtra(Movie.KEY_MOVIE_ID, 0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        viewModel.getMovie(movieId)
    }

    @Composable
    override fun Content() {
        val movie by viewModel.movie.collectAsState()
        var palette by remember { mutableStateOf<Palette?>(null) }
        val painter = rememberAsyncImagePainter(
            model = movie?.coverImageUrl?.imageRequest,
            onState = {
                if (it is AsyncImagePainter.State.Success) {
                    palette = try {
                        Palette.from(it.result.drawable.toBitmap()).generate()
                    } catch (e: Exception) {
                        null
                    }
                }
            }
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .paint(painter, contentScale = ContentScale.Crop)
                .background(MaterialTheme.colorScheme.background.copy(alpha = 0.925f)),
        ) {
            if (movie != null) {
                LazyVerticalGrid(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(
                        vertical = statusBarHeight,
                        horizontal = 8.dp
                    ),
                    columns = GridCells.Fixed(GRID_CELLS),
                    content = {
                        item(span = { GridItemSpan(GRID_CELLS) }) {
                            Title(
                                modifier = Modifier.padding(8.dp),
                            )
                        }
                        item(span = { GridItemSpan(GRID_CELLS) }) {
                            TrailerCard(
                                modifier = Modifier.padding(8.dp),
                                player = viewModel.player,
                                movie = movie,
                            )
                        }
                        item(span = { GridItemSpan(GRID_CELLS) }) {
                            Props(
                                modifier = Modifier.padding(8.dp),
                            )
                        }
                        if (movie?.genres.isNullOrEmpty().not()) {
                            item(span = { GridItemSpan(GRID_CELLS) }) {
                                Genre(
                                    modifier = Modifier.padding(8.dp),
                                )
                            }
                        }
                        items(
                            count = movie?.torrents?.size ?: 0,
                            span = { GridItemSpan(GRID_CELLS / 2) }
                        ) {
                            Torrent(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(8.dp),
                                torrent = movie?.torrents?.get(it),
                            )
                        }
                        if (movie?.description.isNullOrEmpty().not()) {
                            item(span = { GridItemSpan(GRID_CELLS) }) {
                                Description(
                                    modifier = Modifier.padding(8.dp),
                                )
                            }
                        }
                    },
                )
            }
        }
    }

    @Composable
    private fun Title(
        modifier: Modifier = Modifier,
    ) {
        val movie by viewModel.movie.collectAsState()
        Text(
            modifier = modifier,
            text = movie?.title.orEmpty(),
            color = MaterialTheme.colorScheme.onSurface,
            overflow = TextOverflow.Ellipsis,
            fontSize = 28.sp,
            maxLines = 1,
        )
    }

    @Composable
    private fun Props(
        modifier: Modifier = Modifier,
    ) {
        val movie by viewModel.movie.collectAsState()
        val props = movie?.run { listOf(year, displayLanguage) }.orEmpty()
        Text(
            modifier = modifier,
            text = props.joinToString(" • ") { "$it" },
            color = MaterialTheme.colorScheme.onSurface,
            overflow = TextOverflow.Ellipsis,
            fontSize = 18.sp,
            maxLines = 1,
        )
    }

    @Composable
    private fun Genre(
        modifier: Modifier = Modifier,
    ) {
        val movie by viewModel.movie.collectAsState()
        Text(
            modifier = modifier,
            text = movie?.genres?.joinToString(", ") { it.name }.orEmpty(),
            color = MaterialTheme.colorScheme.onSurface,
            overflow = TextOverflow.Ellipsis,
            fontSize = 16.sp,
            maxLines = 1,
        )
    }

    @Composable
    private fun Description(
        modifier: Modifier = Modifier,
    ) {
        val movie by viewModel.movie.collectAsState()
        var maxLines by remember { mutableIntStateOf(MAX_LINES) }
        Text(
            modifier = modifier
                .clickable(
                    interactionSource = MutableInteractionSource(),
                    indication = null,
                ) {
                    maxLines = when (maxLines) {
                        Int.MAX_VALUE -> MAX_LINES
                        else -> Int.MAX_VALUE
                    }
                },
            text = movie?.description.toString(),
            color = MaterialTheme.colorScheme.onSurface,
            overflow = TextOverflow.Ellipsis,
            maxLines = maxLines,
            fontSize = 14.sp,
        )
    }

    @Composable
    private fun Torrent(
        modifier: Modifier = Modifier,
        torrent: Torrent?
    ) {
        OutlinedCard(
            modifier = modifier,
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
            ) {
                Text(
                    text = "${torrent?.quality?.name.orEmpty()} Quality (${torrent?.type.orEmpty()})",
                    color = MaterialTheme.colorScheme.onSurface,
                    overflow = TextOverflow.Clip,
                    fontSize = 14.sp,
                    maxLines = 1,
                )
                Text(
                    text = torrent?.size.orEmpty(),
                    color = MaterialTheme.colorScheme.onSurface,
                    fontSize = 12.sp,
                )
            }
        }
    }

    @Composable
    private fun Palette?.getDominantColor(color: Color): Color {
        return this?.getDominantColor(color.value.toInt())?.let { Color(it) } ?: color
    }

    class Contract : ActivityResultContract<Int, Boolean>() {
        override fun createIntent(context: Context, input: Int): Intent {
            return Intent(context, MovieActivity::class.java).apply {
                putExtra(Movie.KEY_MOVIE_ID, input)
            }
        }

        override fun parseResult(resultCode: Int, intent: Intent?): Boolean {
            return resultCode == RESULT_OK
        }
    }

    companion object {
        private const val GRID_CELLS = 2
        private const val MAX_LINES = Int.MAX_VALUE
    }
}