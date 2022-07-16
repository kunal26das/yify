package io.github.kunal26das.yify.movie.profile

import android.content.Context
import android.content.Intent
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.viewModels
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.essentials.view.ComposeActivity
import coil.compose.AsyncImage
import com.google.accompanist.swiperefresh.SwipeRefresh
import com.google.accompanist.swiperefresh.rememberSwipeRefreshState
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.model.Cast
import io.github.kunal26das.model.Movie
import io.github.kunal26das.model.Movie.Companion.KEY_MOVIE
import io.github.kunal26das.yify.contract.YouTubeContract
import io.github.kunal26das.yify.movie.MovieComposable

@AndroidEntryPoint
@OptIn(ExperimentalMaterial3Api::class)
class MovieActivity : ComposeActivity(), MovieComposable {

    private val viewModel by viewModels<MovieViewModel>()

    private val movieActivity = registerForActivityResult(Contract())
    private val youTube = registerForActivityResult(YouTubeContract())

    private val movie get() = intent.getParcelableExtra<Movie>(KEY_MOVIE)

    @Preview
    @Composable
    override fun setContent() {
        super.setContent()
        val movie by viewModel.movie.observeAsState()
        SwipeRefresh(
            modifier = Modifier.fillMaxSize(),
            state = rememberSwipeRefreshState(
                isRefreshing = movie == null
            ),
            onRefresh = { viewModel.refresh(movie?.id) },
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(ScrollState(0))
            ) {
                Poster(movie)
                Description(movie?.descriptionFull)
                Screenshots(movie?.screenshotImages)
                Suggestions()
            }
        }
    }

    @Composable
    private fun Poster(movie: Movie?) {
        AsyncImage(
            modifier = Modifier.fillMaxWidth(),
            contentDescription = movie?.title,
            model = movie?.coverImage,
            contentScale = ContentScale.FillWidth,
            onSuccess = {
                viewModel.generatePalette(it.result.drawable)
            }
        )
    }

    @Composable
    private fun Description(description: String?) {
        Surface(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(text = description ?: "")
        }
    }

    @Composable
    private fun Cast(cast: List<Cast>?) {
        if (!cast.isNullOrEmpty()) Row(
            modifier = Modifier
                .horizontalScroll(ScrollState(0))
                .padding(8.dp)
        ) {
            cast.forEach {
                AsyncImage(
                    modifier = Modifier
                        .height(100.dp)
                        .width(100.dp)
                        .padding(8.dp)
                        .clip(CircleShape),
                    model = it.urlSmallImage,
                    contentDescription = it.name,
                )
            }
        }
    }

    @Composable
    private fun Screenshots(screenshots: List<String>?) {
        if (!screenshots.isNullOrEmpty()) Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(ScrollState(0))
                .padding(8.dp)
        ) {
            screenshots.forEach {
                ElevatedCard(
                    modifier = Modifier.padding(8.dp)
                ) {
                    AsyncImage(
                        modifier = Modifier.fillMaxWidth(),
                        contentDescription = it,
                        model = it,
                    )
                }
            }
        }
    }

    @Composable
    private fun Suggestions() {
        val suggestions by viewModel.suggestions.observeAsState()
        if (!suggestions.isNullOrEmpty()) Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(ScrollState(0))
                .padding(8.dp)
        ) {
            suggestions?.forEach {
                MovieCard(
                    modifier = Modifier.padding(8.dp),
                    movie = it,
                ) {
                    movieActivity.launch(it)
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        viewModel.refresh(movie?.id)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        viewModel.refresh(movie?.id)
    }

    class Contract : ActivityResultContract<Movie, Boolean>() {
        override fun createIntent(context: Context, input: Movie): Intent {
            return Intent(context, MovieActivity::class.java).also {
                it.putExtra(KEY_MOVIE, input)
            }
        }

        override fun parseResult(resultCode: Int, intent: Intent?): Boolean {
            return resultCode == RESULT_OK
        }
    }

}