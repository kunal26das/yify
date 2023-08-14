package io.github.kunal26das.yify.home

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.yify.common.ComposeActivity
import io.github.kunal26das.yify.compose.AllMovies
import io.github.kunal26das.yify.compose.NewMovies
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

@AndroidEntryPoint
@OptIn(ExperimentalFoundationApi::class)
class HomeActivity : ComposeActivity() {

    @Preview
    @Composable
    override fun Content() {
        val pagerState = rememberPagerState(pageCount = { Destination.size })
        val coroutineScope = rememberCoroutineScope()
        var job by remember { mutableStateOf<Job?>(null) }
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            HorizontalPager(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                state = pagerState,
                pageContent = {
                    when (Destination[it]) {
                        Destination.RecentlyAdded -> NewMovies()
                        Destination.AllMovies -> AllMovies(childFragmentManager = supportFragmentManager)
                        Destination.Settings -> Unit
                    }
                }
            )
            NavigationBar(
                modifier = Modifier.fillMaxWidth()
            ) {
                Destination.forEachIndexed { index, destination ->
                    NavigationBarItem(
                        label = { Text(getString(destination.stringResId)) },
                        icon = { Icon(destination.icon, null) },
                        selected = pagerState.currentPage == index,
                        onClick = {
                            job?.cancel()
                            job = coroutineScope.launch {
                                pagerState.scrollToPage(index)
                            }
                        },
                    )
                }
            }
        }
    }

}
