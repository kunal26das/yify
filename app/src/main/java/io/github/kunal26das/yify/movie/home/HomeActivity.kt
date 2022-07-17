package io.github.kunal26das.yify.movie.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.essentials.view.ComposeActivity
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.accompanist.pager.ExperimentalPagerApi
import com.google.accompanist.pager.HorizontalPager
import com.google.accompanist.pager.rememberPagerState
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.movie.Composables
import io.github.kunal26das.yify.movie.list.AllMoviesFragment
import io.github.kunal26das.yify.movie.list.NewMoviesFragment
import kotlinx.coroutines.launch

@AndroidEntryPoint
@OptIn(ExperimentalPagerApi::class)
class HomeActivity : ComposeActivity(), Composables {

    private val pages by lazy {
        listOf(
            getString(R.string.recently_added),
            getString(R.string.all),
        )
    }

    @Preview
    @Composable
    override fun setContent() {
        super.setContent()
        val pagerState = rememberPagerState()
        Column {
            TabRow(
                modifier = Modifier.fillMaxWidth(),
                selectedTabIndex = pagerState.currentPage,
            ) {
                pages.forEachIndexed { index, title ->
                    Tab(
                        text = { Text(title) },
                        selected = pagerState.currentPage == index,
                        onClick = {
                            lifecycleScope.launch {
                                pagerState.scrollToPage(index)
                            }
                        },
                    )
                }
            }
            HorizontalPager(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                count = pages.size,
                state = pagerState,
            ) {
                when (currentPage) {
                    0 -> FragmentContainer(NewMoviesFragment())
                    else -> FragmentContainer(AllMoviesFragment())
                }
            }
        }
    }

    @Composable
    private fun FragmentContainer(
        fragment: Fragment
    ) {
        FragmentContainer(
            modifier = Modifier.fillMaxSize(),
            fragmentManager = supportFragmentManager,
        ) {
            replace(it, fragment)
        }
    }

}
