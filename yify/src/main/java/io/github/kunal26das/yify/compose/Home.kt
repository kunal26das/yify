package io.github.kunal26das.yify.compose

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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import io.github.kunal26das.yify.Destination
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

@Preview
@Composable
@OptIn(ExperimentalFoundationApi::class)
fun Home() {
    val coroutineScope = rememberCoroutineScope()
    var job by remember { mutableStateOf<Job?>(null) }
    val pagerState = rememberPagerState(pageCount = { Destination.size })
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
                    Destination.AllMovies -> AllMovies()
                    Destination.Settings -> Unit
                }
            }
        )
        NavigationBar(
            modifier = Modifier.fillMaxWidth()
        ) {
            Destination.forEachIndexed { index, destination ->
                NavigationBarItem(
                    label = { Text(stringResource(destination.stringResId)) },
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