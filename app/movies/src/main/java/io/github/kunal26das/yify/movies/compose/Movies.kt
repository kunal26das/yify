package io.github.kunal26das.yify.movies.compose

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.isImeVisible
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material3.DismissibleNavigationDrawer
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.paging.compose.collectAsLazyPagingItems
import io.github.kunal26das.yify.movies.R
import io.github.kunal26das.yify.movies.domain.model.Genre
import io.github.kunal26das.yify.movies.domain.model.OrderBy
import io.github.kunal26das.yify.movies.domain.model.Quality
import io.github.kunal26das.yify.movies.domain.model.SortBy
import io.github.kunal26das.yify.movies.presentation.MoviesViewModel
import kotlinx.coroutines.launch
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun Movies(
    modifier: Modifier = Modifier,
    viewModel: MoviesViewModel = koinViewModel(),
) {
    val state = rememberLazyGridState()
    val cornerRadius = LocalCornerRadius.current
    val coroutineScope = rememberCoroutineScope()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val moviesCount by viewModel.moviesCount.collectAsState()
    val moviePreference by viewModel.moviePreference.collectAsState()
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

    BackHandler(drawerState.isOpen) {
        if (drawerState.isOpen) {
            coroutineScope.launch {
                drawerState.close()
            }
        }
    }

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
                    bottomEnd = LocalCornerRadius.current,
                    topEnd = LocalCornerRadius.current,
                )
            ) {
                DrawerContent()
            }
        },
    ) {
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            topBar = {
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
            },
            content = { contentPadding ->
                Box(
                    modifier = Modifier.fillMaxSize(),
                ) {
                    VerticalGridMovies(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(
                            end = 5.dp,
                            start = 5.dp,
                            top = contentPadding.calculateTopPadding(),
                            bottom = contentPadding.calculateBottomPadding(),
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
                val isImeVisible by rememberUpdatedState(WindowInsets.isImeVisible)
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
                        shape = RoundedCornerShape(cornerRadius / 1.5f)
                    )
                }
            }
        )
    }
}

@Composable
private fun DrawerContent(
    modifier: Modifier = Modifier,
) {
    val contentModifier = Modifier.fillMaxWidth()
    Column(
        modifier = modifier.padding(
            vertical = LocalStatusBarHeight.current,
            horizontal = 16.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        GenreDropdown(modifier = contentModifier)
        QualityDropdown(modifier = contentModifier)
        SortByDropdown(modifier = contentModifier)
        MinimumRating(modifier = contentModifier.padding(horizontal = 8.dp))
        ClearButton(modifier = contentModifier)
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun SearchTextField(
    modifier: Modifier = Modifier,
    viewModel: MoviesViewModel = koinViewModel(),
    shape: Shape = OutlinedTextFieldDefaults.shape,
) {
    val focusManager = LocalFocusManager.current
    var isFocused by remember { mutableStateOf(false) }
    val searchQuery by viewModel.searchQuery.collectAsState()
    val keyboardController = LocalSoftwareKeyboardController.current
    val isImeVisible by rememberUpdatedState(WindowInsets.isImeVisible)

    LaunchedEffect(isImeVisible) {
        if (isImeVisible.not()) {
            focusManager.clearFocus(true)
        }
    }

    OutlinedTextField(
        modifier = modifier.onFocusChanged {
            isFocused = it.isFocused
        },
        readOnly = false,
        shape = shape,
        label = {
            if (isFocused.not() && searchQuery.isEmpty()) {
                Text(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 8.dp),
                    text = stringResource(R.string.search),
                )
            }
        },
        trailingIcon = {
            if (searchQuery.isNotEmpty()) {
                IconButton(
                    modifier = Modifier.padding(end = 8.dp),
                    onClick = {
                        viewModel.search(null)
                        focusManager.clearFocus()
                    },
                    content = {
                        Icon(
                            imageVector = Icons.Filled.Clear,
                            contentDescription = null,
                        )
                    }
                )
            }
        },
        value = searchQuery,
        onValueChange = {
            viewModel.search(it)
        },
        keyboardOptions = KeyboardOptions(
            imeAction = ImeAction.Search,
            autoCorrectEnabled = false,
        ),
        keyboardActions = KeyboardActions(
            onSearch = {
                keyboardController?.hide()
            }
        )
    )
}

@Composable
private fun GenreDropdown(
    modifier: Modifier = Modifier,
    viewModel: MoviesViewModel = koinViewModel()
) {
    val cornerRadius = LocalCornerRadius.current
    val moviePreference by viewModel.moviePreference.collectAsState()
    Dropdown(
        modifier2 = modifier,
        label = stringResource(R.string.genre),
        shape = RoundedCornerShape(cornerRadius / 1.5f),
        selection = moviePreference.genre,
        items = Genre.entries,
        name = { it.name },
        onSelect = {
            viewModel.setGenre(it)
        }
    )
}

@Composable
private fun QualityDropdown(
    modifier: Modifier = Modifier,
    viewModel: MoviesViewModel = koinViewModel(),
) {
    val context = LocalContext.current
    val cornerRadius = LocalCornerRadius.current
    val moviePreference by viewModel.moviePreference.collectAsState()
    Dropdown(
        modifier2 = modifier,
        label = stringResource(R.string.quality),
        shape = RoundedCornerShape(cornerRadius / 1.5f),
        selection = moviePreference.quality,
        items = Quality.entries.reversed(),
        showTrailingIcon = false,
        name = {
            when (it) {
                Quality.Low -> context.getString(R.string.low)
                Quality.Medium -> context.getString(R.string.medium)
                Quality.High -> context.getString(R.string.high)
                else -> ""
            }
        },
        onSelect = {
            viewModel.setQuality(it)
        }
    )
}

@Composable
private fun SortByDropdown(
    modifier: Modifier = Modifier,
    viewModel: MoviesViewModel = koinViewModel(),
) {
    val context = LocalContext.current
    val cornerRadius = LocalCornerRadius.current
    val moviePreference by viewModel.moviePreference.collectAsState()
    Dropdown(
        modifier = modifier,
        modifier2 = Modifier.fillMaxWidth(),
        label = stringResource(R.string.sort_by),
        selection = moviePreference.sortBy,
        shape = RoundedCornerShape(cornerRadius / 1.5f),
        items = listOf(SortBy.DateAdded, SortBy.Title, SortBy.Year, SortBy.Rating),
        name = {
            when (it) {
                SortBy.DateAdded -> context.getString(R.string.date_added)
                SortBy.Peers -> context.getString(R.string.peers)
                SortBy.Rating -> context.getString(R.string.rating)
                SortBy.Seeds -> context.getString(R.string.seeds)
                SortBy.Title -> context.getString(R.string.title)
                SortBy.Year -> context.getString(R.string.year)
            }
        },
        onSelect = {
            viewModel.setSortBy(it)
        },
        trailingIcon = {
            IconButton(
                onClick = {
                    viewModel.setOrderBy(
                        when (moviePreference.orderBy) {
                            OrderBy.Ascending -> OrderBy.Descending
                            OrderBy.Descending -> OrderBy.Ascending
                        }
                    )
                }
            ) {
                Icon(
                    imageVector = when (moviePreference.orderBy) {
                        OrderBy.Descending -> Icons.Filled.ArrowDownward
                        OrderBy.Ascending -> Icons.Filled.ArrowUpward
                    },
                    contentDescription = null,
                )
            }
        }
    )
}

@Composable
private fun MinimumRating(
    modifier: Modifier = Modifier,
    viewModel: MoviesViewModel = koinViewModel(),
) {
    val moviePreference by viewModel.moviePreference.collectAsState()
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = stringResource(R.string.rating))
        Slider(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 12.dp),
            steps = 10,
            valueRange = 0f..9f,
            value = moviePreference.minimumRating.toFloat(),
            onValueChange = {
                viewModel.setMinimumRating(it.toInt())
            }
        )
        Text(text = moviePreference.minimumRating.toString())
    }
}

@Composable
private fun ClearButton(
    modifier: Modifier = Modifier,
    viewModel: MoviesViewModel = koinViewModel()
) {
    OutlinedButton(
        modifier = modifier,
        onClick = { viewModel.clear() },
        contentPadding = PaddingValues(12.dp),
        content = { Text(text = stringResource(R.string.reset)) }
    )
}