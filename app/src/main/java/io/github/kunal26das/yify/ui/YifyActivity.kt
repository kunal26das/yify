package io.github.kunal26das.yify.ui

import android.os.Bundle
import androidx.activity.viewModels
import androidx.lifecycle.asLiveData
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewModelScope
import androidx.paging.cachedIn
import androidx.paging.rxjava2.flowable
import androidx.recyclerview.widget.LinearLayoutManager
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ActivityYifyBinding
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

class YifyActivity : Activity() {

    override val layoutId = R.layout.activity_yify
    private val viewModel by viewModels<YifyViewModel>()
    private val binding by dataBinding<ActivityYifyBinding>()

    private val moviesAdapter = MoviesAdapter()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding.movies.adapter = moviesAdapter
        binding.movies.layoutManager = LinearLayoutManager(this)
        binding.refreshMovies.setOnRefreshListener {
            moviesAdapter.refresh()
        }
        lifecycleScope.launch {
            viewModel.movies.collect {
                moviesAdapter.submitData(it)
                binding.refreshMovies.isRefreshing = false
            }
        }
    }

}
