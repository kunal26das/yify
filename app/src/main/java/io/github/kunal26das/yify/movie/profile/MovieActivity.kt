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
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.rememberPullRefreshState
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
import coil.compose.AsyncImage
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.yify.common.ComposeActivity
import io.github.kunal26das.yify.compose.Chips
import io.github.kunal26das.yify.compose.MovieCard
import io.github.kunal26das.yify.contract.YouTubeContract
import io.github.kunal26das.yify.model.Cast
import io.github.kunal26das.yify.model.Movie
import io.github.kunal26das.yify.model.Movie.Companion.KEY_MOVIE

@AndroidEntryPoint
@OptIn(ExperimentalMaterial3Api::class)
class MovieActivity : ComposeActivity() {

    private val viewModel by viewModels<MovieViewModel>()

    private val movieActivity = registerForActivityResult(Contract())
    private val youTube = registerForActivityResult(YouTubeContract())

    private val movieDelegate = lazy { intent.getParcelableExtra(KEY_MOVIE, Movie::class.java) }
    private val movie by movieDelegate

    @OptIn(ExperimentalMaterialApi::class)
    @Preview
    @Composable
    override fun Content() {
        val pullRefreshState = rememberPullRefreshState(
            onRefresh = { viewModel.refresh(movie?.id) },
            refreshing = movie == null,
        )
        val movie by viewModel.movie.observeAsState()
        val palette by viewModel.palette.observeAsState()
//        PullRefreshIndicator(
//            modifier = Modifier.fillMaxSize(),
//            refreshing = movie == null,
//            state = pullRefreshState,
//        )
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(ScrollState(0))
        ) {
            Poster(movie)
            if (palette != null) Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(
                        vertical = 4.dp,
                        horizontal = 8.dp,
                    )
            ) {
                Description(movie?.descriptionFull)
                Genres(movie?.genres)
                Screenshots(movie)
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
            },
        )
    }

    @Composable
    private fun Genres(genres: List<String>?) {
        if (!genres.isNullOrEmpty()) Chips(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(ScrollState(0))
                .padding(
                    vertical = 4.dp,
                    horizontal = 8.dp,
                ),
            chips = genres,
        )
    }

    @Composable
    private fun Description(description: String?) {
        if (!description.isNullOrEmpty()) Surface(
            modifier = Modifier.padding(8.dp)
        ) {
            Text(text = description)
        }
    }

    @Composable
    private fun Cast(cast: List<Cast>?) {
        if (!cast.isNullOrEmpty()) Row(
            modifier = Modifier
                .horizontalScroll(ScrollState(0))
                .padding(4.dp)
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
    private fun Screenshots(movie: Movie?) {
        val screenshots = movie?.screenshotImages
        if (!screenshots.isNullOrEmpty()) Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(ScrollState(0))
                .padding(4.dp)
        ) {
            screenshots.forEachIndexed { i, it ->
                if (it != null) ElevatedCard(
                    modifier = Modifier.padding(8.dp),
                    onClick = {
                        if (i == 0) youTube.launch(movie.ytTrailerCode)
                    }
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
                .padding(4.dp)
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
//        movieDelegate.onStateChanged(this, Lifecycle.Event.ON_DESTROY)
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