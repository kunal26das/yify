package io.github.kunal26das.yify.ui

import android.os.Bundle
import androidx.activity.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.DividerItemDecoration.VERTICAL
import androidx.recyclerview.widget.StaggeredGridLayoutManager
import com.google.android.material.snackbar.BaseTransientBottomBar.LENGTH_LONG
import com.google.android.material.snackbar.Snackbar
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ActivityMovieListBinding
import io.github.kunal26das.yify.repository.Preference
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

@AndroidEntryPoint
class MovieListActivity : Activity() {

    private val dataStore by dataStore()
    private val moviesAdapter = MoviesAdapter()
    override val layoutId = R.layout.activity_movie_list
    private val viewModel by viewModels<MovieListViewModel>()
    private val binding by dataBinding<ActivityMovieListBinding>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding.movies.adapter = moviesAdapter
        binding.movies.layoutManager = StaggeredGridLayoutManager(2, VERTICAL)
        binding.refreshMovies.setOnRefreshListener {
            moviesAdapter.refresh()
        }
        binding.filter.setOnClickListener {
            FilterFragment().apply {
                setOnQualityChangeListener {
                    lifecycleScope.launch {
                        dataStore.set(Preference.Quality, it)
                        moviesAdapter.refresh()
                    }
                }
            }.showNow(supportFragmentManager, null)
        }
        lifecycleScope.launch {
            viewModel.movies.collect {
                moviesAdapter.submitData(it)
                binding.refreshMovies.isRefreshing = false
            }
        }
        viewModel.loading.observe(this) {
            binding.refreshMovies.isRefreshing = it
        }
        viewModel.error.observe(this) {
            if (it != null) {
                Snackbar.make(binding.root, "${it.message}", LENGTH_LONG).show()
            }
        }
    }

}
