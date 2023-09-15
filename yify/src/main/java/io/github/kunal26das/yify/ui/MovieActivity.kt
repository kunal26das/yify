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
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
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
import io.github.kunal26das.yify.Constants
import io.github.kunal26das.yify.compose.TrailerCard
import io.github.kunal26das.yify.compose.imageRequest
import io.github.kunal26das.yify.domain.model.Movie

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
        var maxLines by remember { mutableIntStateOf(MAX_LINES) }
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
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(
                        vertical = statusBarHeight,
                    ),
                    content = {
                        item {
                            Text(
                                modifier = Modifier.padding(
                                    horizontal = 16.dp,
                                    vertical = 8.dp,
                                ),
                                text = movie?.title.orEmpty(),
                                color = MaterialTheme.colorScheme.onSurface,
                                overflow = TextOverflow.Ellipsis,
                                fontSize = 28.sp,
                                maxLines = 1,
                            )
                        }
                        item {
                            TrailerCard(
                                modifier = Modifier
                                    .height(Constants.trailerHeight)
                                    .padding(
                                        horizontal = 16.dp,
                                        vertical = 8.dp,
                                    ),
                                url = movie?.trailerImageUrl,
                            )
                        }
                        item {
                            Text(
                                modifier = Modifier.padding(
                                    horizontal = 16.dp,
                                    vertical = 8.dp,
                                ),
                                text = movie?.year.toString(),
                                color = MaterialTheme.colorScheme.onSurface,
                                fontSize = 18.sp,
                            )
                        }
                        item {
                            Text(
                                modifier = Modifier
                                    .padding(
                                        horizontal = 16.dp,
                                        vertical = 8.dp,
                                    )
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
                    },
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
        private const val MAX_LINES = 5
    }
}