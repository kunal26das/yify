package io.github.kunal26das.yify.movies.presentation

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.SuggestionChip
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.graphics.drawable.toBitmap
import androidx.palette.graphics.Palette
import coil.compose.AsyncImagePainter
import coil.compose.rememberAsyncImagePainter
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.common.compose.statusBarHeight
import io.github.kunal26das.common.core.YifyActivity
import io.github.kunal26das.yify.movies.compose.TrailerCard
import io.github.kunal26das.yify.movies.compose.imageRequest
import io.github.kunal26das.yify.movies.domain.model.Movie
import io.github.kunal26das.yify.movies.domain.model.Torrent

@AndroidEntryPoint
class MovieActivity : YifyActivity() {

    private val viewModel by viewModels<MovieViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        refresh(intent)
    }

    @Composable
    override fun Content() {
        val movie by viewModel.movie.collectAsState()
        var palette by remember { mutableStateOf<Palette?>(null) }
        val painter = rememberAsyncImagePainter(
            model = movie?.largeCoverImageUrl?.imageRequest,
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .paint(painter, contentScale = ContentScale.Crop)
                .background(MaterialTheme.colorScheme.background.copy(alpha = 0.925f))
                .padding(top = statusBarHeight),
        ) {
            if (movie != null) {
                TrailerCard(
                    modifier = Modifier.padding(0.dp),
                    movie = movie,
                )
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(top = 8.dp, bottom = statusBarHeight),
                    content = {
                        item {
                            Title(
                                modifier = Modifier.padding(
                                    horizontal = 16.dp,
                                    vertical = 4.dp,
                                ),
                            )
                        }
                        item {
                            Props(
                                modifier = Modifier.padding(
                                    horizontal = 16.dp,
                                    vertical = 4.dp,
                                ),
                            )
                        }
                        if (movie?.genres.isNullOrEmpty().not()) {
                            item {
                                Genre(
                                    modifier = Modifier.padding(
                                        vertical = 4.dp,
                                    ),
                                )
                            }
                        }
                        if (movie?.description.isNullOrEmpty().not()) {
                            item {
                                Description(
                                    modifier = Modifier.padding(
                                        horizontal = 16.dp,
                                        vertical = 4.dp,
                                    ),
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
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp,
            maxLines = 2,
        )
    }

    @Composable
    private fun Props(
        modifier: Modifier = Modifier,
    ) {
        val movie by viewModel.movie.collectAsState()
        val props = movie?.run { listOf(rating, year, language) }.orEmpty()
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
    ) {
        val movie by viewModel.movie.collectAsState()
        LazyRow(
            modifier = modifier,
            contentPadding = PaddingValues(horizontal = 12.dp),
            content = {
                items(movie?.genres.orEmpty()) { genre ->
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
    ) {
        val movie by viewModel.movie.collectAsState()
        var maxLines by remember { mutableIntStateOf(MAX_LINES) }
        Text(
            modifier = modifier.clickable(
                interactionSource = remember {
                    MutableInteractionSource()
                },
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
        modifier: Modifier = Modifier, torrent: Torrent?
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

    private fun refresh(intent: Intent) {
        val movie = intent.getSerializableExtra(Movie.KEY_MOVIE, Movie::class.java)
        viewModel.setMovie(movie)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        refresh(intent)
    }

    class Contract : ActivityResultContract<Movie, Boolean>() {
        override fun createIntent(context: Context, input: Movie): Intent {
            return Intent(context, MovieActivity::class.java).apply {
                putExtra(Movie.KEY_MOVIE, input)
            }
        }

        override fun parseResult(resultCode: Int, intent: Intent?): Boolean {
            return resultCode == RESULT_OK
        }
    }

    companion object {
        private const val MAX_LINES = Int.MAX_VALUE
    }
}