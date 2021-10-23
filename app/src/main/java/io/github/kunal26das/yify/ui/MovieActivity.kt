package io.github.kunal26das.yify.ui

import android.os.Bundle
import androidx.activity.viewModels
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ActivityMovieBinding
import io.github.kunal26das.yify.models.Movie

class MovieActivity : Activity() {

    override val layoutId = R.layout.activity_movie
    private val viewModel by viewModels<MovieViewModel>()
    private val binding by dataBinding<ActivityMovieBinding>()

    private val movie by lazy { intent.getParcelableExtra<Movie>("Movie") }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding.fullDescription.text = movie?.descriptionFull
    }

}