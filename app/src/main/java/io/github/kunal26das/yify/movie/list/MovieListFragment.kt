package io.github.kunal26das.yify.movie.list

import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.yify.core.ComposeFragment
import io.github.kunal26das.yify.movie.Composables
import io.github.kunal26das.yify.movie.profile.MovieActivity

@AndroidEntryPoint
abstract class MovieListFragment : ComposeFragment(), Composables {

    protected abstract val viewModel: MovieListViewModel
    protected val movieActivity = registerForActivityResult(MovieActivity.Contract())

}
