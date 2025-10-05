package io.github.kunal26das.yify.movies.compose

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DismissibleNavigationDrawer
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.paging.compose.collectAsLazyPagingItems
import chaintech.videoplayer.host.MediaPlayerHost
import chaintech.videoplayer.ui.youtube.YouTubePlayerComposable
import io.github.kunal26das.yify.movies.Constants.TRAILER_ASPECT_RATIO
import io.github.kunal26das.yify.movies.presentation.MoviesViewModel
import kotlinx.coroutines.launch
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalLayoutApi::class, ExperimentalComposeUiApi::class)
@Composable
fun Movies(
    modifier: Modifier = Modifier,
    viewModel: MoviesViewModel = koinViewModel(),
) {
    val state = rememberLazyGridState()
    val cornerRadius = LocalCornerRadius.current
    val coroutineScope = rememberCoroutineScope()
    var selectedMovie by LocalSelectedMovie.current
    val moviesCount by viewModel.moviesCount.collectAsState()
    val moviePreference by viewModel.moviePreference.collectAsState()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val uncategorizedMovies = viewModel.uncategorizedMovies.collectAsLazyPagingItems()

    val firstVisibleItemIndex by remember {
        derivedStateOf {
            state.firstVisibleItemIndex
        }
    }

    val visibleItemsCount by remember {
        derivedStateOf {
            state.layoutInfo.visibleItemsInfo.size
        }
    }

//    BackHandler(selectedMovie != null) {
//        if (selectedMovie != null) {
//            selectedMovie = null
//        }
//    }

//    BackHandler(drawerState.isOpen) {
//        if (drawerState.isOpen) {
//            coroutineScope.launch {
//                drawerState.close()
//            }
//        }
//    }

    LaunchedEffect(moviePreference) {
        try {
            state.scrollToItem(0)
        } catch (_: IndexOutOfBoundsException) {
        }
    }

    DismissibleNavigationDrawer(
        modifier = modifier,
        drawerState = drawerState,
        drawerContent = {
            ElevatedCard(
                modifier = Modifier
                    .width(360.dp)
                    .fillMaxHeight(),
                shape = RoundedCornerShape(
                    topEnd = LocalCornerRadius.current,
                    bottomEnd = 0.dp,
                )
            ) {
                DrawerContent()
            }
        },
    ) {
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            topBar = {
                AnimatedContent(
                    modifier = Modifier,
                    targetState = selectedMovie,
                    contentAlignment = Alignment.TopCenter,
                    label = selectedMovie?.title.orEmpty(),
                ) { movie ->
                    if (movie != null) {
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .statusBarsPadding(),
                            shape = RoundedCornerShape(cornerRadius / 1.5f),
                            color = MaterialTheme.colorScheme.surfaceContainerLow,
                            shadowElevation = 16.dp,
                        ) {
                            YouTubePlayerComposable(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .aspectRatio(TRAILER_ASPECT_RATIO),
                                playerHost = remember {
                                    MediaPlayerHost(mediaUrl = movie.youtubeTrailerCode)
                                }
                            )
                        }
                    } else {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(statusBarHeight)
                                .background(
                                    brush = Brush.verticalGradient(
                                        0f to MaterialTheme.colorScheme.background.copy(alpha = 0.9f),
                                        1f to Color.Transparent,
                                    )
                                )
                        )
                    }
                }
            },
            content = { contentPadding ->
                val selectedMovie by LocalSelectedMovie.current
                Box(
                    modifier = Modifier.fillMaxSize(),
                ) {
                    VerticalGridMovies(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(
                            bottom = contentPadding.calculateBottomPadding(),
                            top = contentPadding.calculateTopPadding() + when (selectedMovie) {
                                null -> 0.dp
                                else -> 5.dp
                            },
                            start = 5.dp,
                            end = 5.dp,
                        ),
                        moviePadding = PaddingValues(5.dp),
                        movies = uncategorizedMovies,
                        state = state,
                    )
                    AnimatedVisibility(
                        modifier = Modifier
                            .padding(bottom = contentPadding.calculateBottomPadding() + 8.dp)
                            .align(Alignment.BottomCenter),
                        visible = moviesCount > 0 && firstVisibleItemIndex > 0,
                        enter = fadeIn(),
                        exit = fadeOut(),
                    ) {
                        Text(
                            modifier = Modifier
                                .background(
                                    shape = RoundedCornerShape(32.dp),
                                    color = MaterialTheme.colorScheme.background,
                                )
                                .padding(
                                    horizontal = 10.dp,
                                    vertical = 2.dp,
                                ),
                            text = "${firstVisibleItemIndex + visibleItemsCount}/${moviesCount}",
                            color = MaterialTheme.colorScheme.onSurface,
                            textAlign = TextAlign.Center,
                            fontSize = 12.sp,
                        )
                    }
                }
            },
            bottomBar = {
                val isImeVisible = false // by rememberUpdatedState(WindowInsets.isImeVisible)
                val bottomPadding by animateDpAsState(
                    targetValue = if (isImeVisible) 16.dp else 0.dp,
                    label = "bottomPadding"
                )
                Surface(
                    modifier = Modifier
                        .fillMaxWidth(),
                    shape = RoundedCornerShape(
                        topStart = cornerRadius / 1.5f,
                        topEnd = cornerRadius / 1.5f,
                    ),
                    color = MaterialTheme.colorScheme.surfaceContainerLow,
                    shadowElevation = 16.dp,
                ) {
                    SearchTextField(
                        modifier = Modifier
                            .navigationBarsPadding()
                            .padding(
                                horizontal = 10.dp,
                                vertical = 8.dp,
                            )
                            .padding(
                                bottom = bottomPadding,
                            ),
                        shape = RoundedCornerShape(cornerRadius / 1.5f),
                        onFilterClick = {
                            if (drawerState.isClosed) {
                                coroutineScope.launch {
                                    drawerState.open()
                                }
                            }
                        }
                    )
                }
            }
        )
    }
}