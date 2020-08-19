package io.github.kunal26das.yify.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import androidx.essentials.core.Activity
import io.github.kunal26das.yify.R
import kotlinx.android.synthetic.main.activity_yify.*

class YifyActivity : Activity() {

    override val layout = R.layout.activity_yify
    override val viewModel by viewModel<YifyViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        )
        movies.setOnMovieClickListener {
            Intent(this, MovieActivity::class.java).apply {
                putExtra(getString(R.string.movie), it)
                startActivity(this)
                Log.d(getString(R.string.movie), "$it")
            }
        }
        fab.setOnClickListener {
            bottomSheetView.switch()
        }
    }

    override fun initObservers() {
        viewModel.movies.observe {
            movies.submitList(it)
        }
    }

}
