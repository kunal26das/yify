package io.github.kunal26das.yify.movie.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.viewinterop.AndroidViewBinding
import androidx.essentials.view.ComposeActivity
import com.google.accompanist.pager.ExperimentalPagerApi
import com.google.accompanist.pager.HorizontalPager
import com.google.accompanist.pager.rememberPagerState
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.yify.databinding.FragmentAllMoviesBinding
import io.github.kunal26das.yify.databinding.FragmentNewMoviesBinding
import io.github.kunal26das.yify.databinding.FragmentSettingsBinding
import io.github.kunal26das.yify.movie.Composables
import kotlinx.coroutines.launch

@AndroidEntryPoint
@OptIn(ExperimentalPagerApi::class)
class HomeActivity : ComposeActivity(), Composables {

    @Preview
    @Composable
    override fun setContent() {
        super.setContent()
        val pagerState = rememberPagerState()
        val coroutineScope = rememberCoroutineScope()
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            HorizontalPager(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                count = Destination.size,
                state = pagerState,
            ) {
                when (Destination[currentPage]) {
                    Destination.RecentlyAdded -> AndroidViewBinding(FragmentNewMoviesBinding::inflate)
                    Destination.AllMovies -> AndroidViewBinding(FragmentAllMoviesBinding::inflate)
                    Destination.Settings -> AndroidViewBinding(FragmentSettingsBinding::inflate)
                }
            }
            NavigationBar(
                modifier = Modifier.fillMaxWidth()
            ) {
                Destination.forEachIndexed { index, destination ->
                    NavigationBarItem(
                        label = { Text(getString(destination.stringResId)) },
                        icon = { Icon(destination.icon, null) },
                        selected = pagerState.currentPage == index,
                        onClick = {
                            coroutineScope.launch {
                                pagerState.animateScrollToPage(index)
                            }
                        },
                    )
                }
            }
        }
    }

}
