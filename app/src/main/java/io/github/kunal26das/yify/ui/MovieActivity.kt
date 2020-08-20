package io.github.kunal26das.yify.ui

import android.os.Bundle
import android.view.WindowManager
import androidx.essentials.core.Activity
import androidx.essentials.core.KoinComponent.inject
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.source.models.Movie
import kotlinx.android.synthetic.main.activity_movie.*

class MovieActivity : Activity() {

    private lateinit var movie: Movie
    override val layout = R.layout.activity_movie
    override val viewModel by inject<MovieViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        )
        movie = intent.getParcelableExtra(getString(R.string.movie))!!
        fullDescription.text = movie.descriptionFull
        torrents.submitList(movie.torrents)
        movieView.item = movie
    }

}