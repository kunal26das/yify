package io.github.kunal26das.yify.movie.profile

import android.content.Context
import android.content.Intent
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.viewModels
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.essentials.view.ComposeActivity
import coil.compose.AsyncImage
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.model.Movie
import io.github.kunal26das.model.Movie.Companion.KEY_MOVIE
import io.github.kunal26das.yify.contract.YouTubeContract

@AndroidEntryPoint
class MovieActivity : ComposeActivity() {

    private val viewModel by viewModels<MovieViewModel>()

    private val youTube = registerForActivityResult(YouTubeContract())
    private val movieActivity = registerForActivityResult(MovieActivity)

    private val movie by lazy { intent.getParcelableExtra<Movie>(KEY_MOVIE)!! }

    @Preview
    @Composable
    override fun setContent() {
        super.setContent()
        val movie by viewModel.movie.observeAsState()
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(ScrollState(0))
        ) {
            AsyncImage(
                modifier = Modifier.fillMaxWidth(),
                contentDescription = null,
                model = movie?.coverImage,
            )
            Surface(
                modifier = Modifier.padding(16.dp)
            ) {
                Text(text = movie?.descriptionFull ?: "")
            }
        }
    }

    override fun onStart() {
        super.onStart()
        viewModel.getMovie(movie)
        viewModel.getMovieSuggestions(movie)
    }

    companion object : ActivityResultContract<Movie, Boolean>() {
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