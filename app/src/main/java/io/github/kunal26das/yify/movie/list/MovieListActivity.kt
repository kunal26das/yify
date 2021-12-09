package io.github.kunal26das.yify.movie.list

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.viewModels
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.recyclerview.widget.RecyclerView.SCROLL_STATE_IDLE
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.core.Activity
import io.github.kunal26das.yify.databinding.ActivityMovieListBinding
import io.github.kunal26das.yify.movie.MoviesPagingAdapter
import io.github.kunal26das.yify.movie.filter.MovieFilterFragment
import io.github.kunal26das.yify.movie.profile.MovieActivity
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

@AndroidEntryPoint
class MovieListActivity : Activity() {

    private val moviesAdapter = MoviesPagingAdapter()
    override val layoutId = R.layout.activity_movie_list
    private val viewModel by viewModels<MovieListViewModel>()
    private val binding by dataBinding<ActivityMovieListBinding>()
    private val layoutManager by lazy { GridLayoutManager(this, 2) }
    private val movieActivity = registerForActivityResult(MovieActivity) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding.movies.adapter = moviesAdapter
        binding.movies.layoutManager = layoutManager
        moviesAdapter.setOnClickListener {
            movieActivity.launch(it)
        }
        binding.filter.setOnClickListener {
            MovieFilterFragment().apply {
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
            when (it) {
                null -> binding.refreshMovies.setOnRefreshListener {
                    binding.refreshMovies.isRefreshing = false
                }
                else -> binding.refreshMovies.setOnRefreshListener {
                    moviesAdapter.refresh()
                }
            }
        }
    }

    companion object : ActivityResultContract<Any?, Boolean>() {
        override fun createIntent(context: Context, input: Any?): Intent {
            return Intent(context, MovieListActivity::class.java)
        }

        override fun parseResult(resultCode: Int, intent: Intent?): Boolean {
            return resultCode == RESULT_OK
        }
    }

}
