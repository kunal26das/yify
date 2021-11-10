package io.github.kunal26das.yify.movie.profile

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.viewModels
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import coil.load
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.contract.YouTubeContract
import io.github.kunal26das.yify.core.Activity
import io.github.kunal26das.yify.databinding.ActivityMovieBinding
import io.github.kunal26das.yify.models.Movie
import io.github.kunal26das.yify.models.Movie.Companion.KEY_MOVIE
import io.github.kunal26das.yify.movie.MoviesAdapter

@AndroidEntryPoint
class MovieActivity : Activity() {

    private val moviesAdapter = MoviesAdapter()
    override val layoutId = R.layout.activity_movie
    private val viewModel by viewModels<MovieViewModel>()
    private val binding by dataBinding<ActivityMovieBinding>()
    private val youTube = registerForActivityResult(YouTubeContract()) {}
    private val movieActivity = registerForActivityResult(MovieActivity) {}
    private val movie by lazy { intent.getParcelableExtra<Movie>(KEY_MOVIE)!! }
    private val layoutManager = LinearLayoutManager(this, RecyclerView.HORIZONTAL, false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding.movie = movie
        viewModel.getMovieSuggestions(movie)
        binding.image.load(movie.coverImage)
        binding.suggestions.adapter = moviesAdapter
        binding.suggestions.layoutManager = layoutManager
        binding.trailer.setOnClickListener {
            youTube.launch(movie.ytTrailerCode)
        }
        moviesAdapter.setOnClickListener {
            movieActivity.launch(it)
        }
        viewModel.movieSuggestions.observe(this) {
            moviesAdapter.submitList(it)
        }
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