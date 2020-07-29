package io.github.kunal26das.yify.ui

import android.content.res.Configuration
import android.os.Bundle
import android.view.View
import androidx.essentials.core.Fragment
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.LinearLayoutManager
import io.github.kunal26das.yify.R
import kotlinx.android.synthetic.main.fragment_yify.*
import io.github.kunal26das.yify.list.MoviesAdapter

class YifyFragment : Fragment() {

    private val moviesAdapter = MoviesAdapter()
    override val layout = R.layout.fragment_yify
    override val viewModel by sharedViewModel<YifyViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setHasOptionsMenu(true)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        moviesRecyclerView.adapter = moviesAdapter
        resources.configuration.apply {
            moviesRecyclerView.layoutManager = when (orientation) {
                Configuration.ORIENTATION_LANDSCAPE -> GridLayoutManager(context, 2)
                else -> LinearLayoutManager(context)
            }
        }

    }

    override fun initObservers() {
        viewModel.movies.observe {
            moviesAdapter.submitList(it)
        }
    }

}