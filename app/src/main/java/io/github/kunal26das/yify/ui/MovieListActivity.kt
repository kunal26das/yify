package io.github.kunal26das.yify.ui

import android.os.Bundle
import androidx.activity.viewModels
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.recyclerview.widget.RecyclerView.SCROLL_STATE_IDLE
import com.google.android.material.snackbar.BaseTransientBottomBar.LENGTH_LONG
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
    private val layoutManager by lazy { GridLayoutManager(this, 2) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding.movies.adapter = moviesAdapter
        binding.movies.layoutManager = layoutManager
        binding.filter.setOnClickListener {
            FilterFragment().apply {
                setOnFiltersChangeListener {
                    moviesAdapter.refresh()
                }
            }.showNow(supportFragmentManager, null)
        }
        binding.refreshMovies.setOnRefreshListener {
            binding.refreshMovies.isRefreshing = false
        }
        binding.movies.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                super.onScrolled(recyclerView, dx, dy)
                try {
                    val position = layoutManager.findFirstCompletelyVisibleItemPosition()
                    val movie = moviesAdapter.snapshot()[position]
                    binding.page.text = movie?.page.toString()
                } catch (e: IndexOutOfBoundsException) {
                }
            }

            override fun onScrollStateChanged(recyclerView: RecyclerView, newState: Int) {
                super.onScrollStateChanged(recyclerView, newState)
                binding.page.isVisible = newState != SCROLL_STATE_IDLE
                when (newState) {
                    SCROLL_STATE_IDLE -> binding.filter.extend()
                    else -> binding.filter.shrink()
                }
            }
        })
        lifecycleScope.launch {
            viewModel.movies.collect {
                moviesAdapter.submitData(it)
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
