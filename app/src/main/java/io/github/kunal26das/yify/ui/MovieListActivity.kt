package io.github.kunal26das.yify.ui

import android.os.Bundle
import androidx.activity.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.DividerItemDecoration
import androidx.recyclerview.widget.DividerItemDecoration.VERTICAL
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.snackbar.BaseTransientBottomBar.LENGTH_INDEFINITE
import com.google.android.material.snackbar.Snackbar
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ActivityMovieListBinding
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

@AndroidEntryPoint
class MovieListActivity : Activity() {

    private val moviesAdapter = MoviesAdapter()
    override val layoutId = R.layout.activity_movie_list
    private val viewModel by viewModels<MovieListViewModel>()
    private val binding by dataBinding<ActivityMovieListBinding>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding.movies.adapter = moviesAdapter
        binding.movies.layoutManager = LinearLayoutManager(this)
        binding.movies.addItemDecoration(DividerItemDecoration(this, VERTICAL))
        binding.refreshMovies.setOnRefreshListener {
            moviesAdapter.refresh()
        }
        lifecycleScope.launch {
            viewModel.movies.collect {
                moviesAdapter.submitData(it)
                binding.refreshMovies.isRefreshing = false
            }
        }
        viewModel.error.observe(this) {
            if (it != null) {
                Snackbar.make(binding.root, "${it.message}", LENGTH_INDEFINITE).show()
            }
        }
    }

}
