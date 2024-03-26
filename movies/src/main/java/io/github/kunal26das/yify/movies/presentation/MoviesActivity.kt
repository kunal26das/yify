package io.github.kunal26das.yify.movies.presentation

import android.content.Context
import android.content.Intent
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.BackHandler
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.paging.compose.collectAsLazyPagingItems
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.common.compose.Dropdown
import io.github.kunal26das.common.compose.statusBarHeight
import io.github.kunal26das.common.core.YifyActivity
import io.github.kunal26das.yify.movies.R
import io.github.kunal26das.yify.movies.compose.SystemBarGradient
import io.github.kunal26das.yify.movies.compose.VerticalGridMovies
import io.github.kunal26das.yify.movies.domain.model.Genre
import io.github.kunal26das.yify.movies.domain.model.OrderBy
import io.github.kunal26das.yify.movies.domain.model.Quality
import io.github.kunal26das.yify.movies.domain.model.SortBy

@AndroidEntryPoint
class MoviesActivity : YifyActivity() {

    private val viewModel by viewModels<MoviesYifyViewModel>()

    private lateinit var onBackPressedCallback: OnBackPressedCallback

    @Composable
    override fun Content() {
        val state = rememberLazyGridState()
        val drawerState = rememberDrawerState(DrawerValue.Closed)
        val moviePreference by viewModel.moviePreference.collectAsState()
        val uncategorizedMovies = viewModel.uncategorizedMovies.collectAsLazyPagingItems()

        LaunchedEffect(moviePreference) {
            try {
                state.scrollToItem(0)
            } catch (_: IndexOutOfBoundsException) {
            }
        }

        onBackPressedCallback = addOnBackPressedDispatcherCallback(rememberCoroutineScope()) {
            if (drawerState.isOpen) drawerState.close() else finish()
        }

        BackHandler(true) {
            onBackPressedCallback.handleOnBackPressed()
        }

        DismissibleNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                ElevatedCard(
                    modifier = Modifier
                        .width(360.dp)
                        .fillMaxHeight(),
                    shape = RoundedCornerShape(
                        bottomEnd = 16.dp,
                        topEnd = 16.dp,
                    )
                ) {
                    DrawerContent()
                }
            },
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                VerticalGridMovies(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(
                        vertical = statusBarHeight,
                        horizontal = 5.dp,
                    ),
                    moviePadding = PaddingValues(5.dp),
                    movies = uncategorizedMovies,
                    state = state,
                )
                SystemBarGradient(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.TopCenter),
                    reverse = false,
                )
                SystemBarGradient(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter),
                    reverse = true,
                )
            }
        }
    }

    @Composable
    private fun DrawerContent(
        modifier: Modifier = Modifier,
    ) {
        val contentModifier = Modifier.fillMaxWidth()
        Column(
            modifier = modifier.padding(
                vertical = statusBarHeight,
                horizontal = 16.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SearchTextField(modifier = contentModifier)
            GenreDropdown(modifier = contentModifier)
            QualityDropdown(modifier = contentModifier)
            SortByDropdown(modifier = contentModifier)
//            Preview(modifier = contentModifier)
            MinimumRating(modifier = contentModifier)
            ClearButton(modifier = contentModifier)
        }
    }

    @Composable
    private fun SearchTextField(
        modifier: Modifier = Modifier,
    ) {
        val focusManager = LocalFocusManager.current
        val searchQuery by viewModel.searchQuery.collectAsState()
        val keyboardController = LocalSoftwareKeyboardController.current
        OutlinedTextField(
            modifier = modifier,
            readOnly = false,
            label = { Text(stringResource(R.string.search)) },
            trailingIcon = {
                IconButton(
                    onClick = {
                        viewModel.search(null)
                        focusManager.clearFocus()
                    }
                ) {
                    Icon(
                        imageVector = Icons.Filled.Clear,
                        contentDescription = null,
                    )
                }
            },
            value = searchQuery,
            onValueChange = {
                viewModel.search(it)
            },
            keyboardOptions = KeyboardOptions(
                imeAction = ImeAction.Search,
                autoCorrect = false,
            ),
            keyboardActions = KeyboardActions(
                onSearch = {
                    onBackPressedCallback.handleOnBackPressed()
                    keyboardController?.hide()
                }
            )
        )
    }

    @Composable
    private fun GenreDropdown(
        modifier: Modifier = Modifier,
    ) {
        val moviePreference by viewModel.moviePreference.collectAsState()
        Dropdown(
            modifier2 = modifier,
            label = stringResource(R.string.genre),
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
    ) {
        val moviePreference by viewModel.moviePreference.collectAsState()
        Dropdown(
            modifier2 = modifier,
            label = stringResource(R.string.quality),
            selection = moviePreference.quality,
            items = Quality.entries.reversed(),
            name = {
                when (it) {
                    Quality.Low -> getString(R.string.low)
                    Quality.Medium -> getString(R.string.medium)
                    Quality.High -> getString(R.string.high)
                    else -> ""
                }
            },
            onSelect = {
                viewModel.setQuality(it)
            }
        )
    }

    @Composable
    private fun MinimumRating(
        modifier: Modifier = Modifier,
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
                value = moviePreference.minimumRating?.toFloat() ?: 0f,
                onValueChange = {
                    viewModel.setMinimumRating(it.toInt())
                }
            )
            Text(text = moviePreference.minimumRating.toString())
        }
    }

    @Composable
    private fun SortByDropdown(
        modifier: Modifier = Modifier,
    ) {
        val moviePreference by viewModel.moviePreference.collectAsState()
        Dropdown(
            modifier = modifier,
            modifier2 = Modifier.fillMaxWidth(),
            label = stringResource(R.string.sort_by),
            selection = moviePreference.sortBy,
            items = listOf(SortBy.DateAdded, SortBy.Title, SortBy.Year, SortBy.Rating),
            name = {
                when (it) {
                    SortBy.DateAdded -> getString(R.string.date_added)
                    SortBy.Peers -> getString(R.string.peers)
                    SortBy.Rating -> getString(R.string.rating)
                    SortBy.Seeds -> getString(R.string.seeds)
                    SortBy.Title -> getString(R.string.title)
                    SortBy.Year -> getString(R.string.year)
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
    private fun ClearButton(
        modifier: Modifier = Modifier,
    ) {
        OutlinedButton(
            modifier = modifier,
            onClick = { viewModel.clear() },
            contentPadding = PaddingValues(12.dp),
            content = { Text(text = stringResource(R.string.reset)) }
        )
    }

    class Contract : ActivityResultContract<Any?, Boolean>() {
        override fun createIntent(context: Context, input: Any?): Intent {
            return Intent(context, MoviesActivity::class.java)
        }

        override fun parseResult(resultCode: Int, intent: Intent?): Boolean {
            return resultCode == RESULT_OK
        }
    }
}
