package io.github.kunal26das.yify.movie.list

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.essentials.view.ComposeActivity
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.yify.movie.Composables

@AndroidEntryPoint
class MovieListActivity : ComposeActivity(), Composables {

    @Preview
    @Composable
    override fun setContent() {
        super.setContent()
        FragmentContainer(
            modifier = Modifier.fillMaxSize(),
            fragmentManager = supportFragmentManager,
        ) {
            replace(it, MovieListFragment())
        }
    }

}
