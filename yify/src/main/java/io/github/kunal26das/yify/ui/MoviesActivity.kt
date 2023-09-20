package io.github.kunal26das.yify.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.BackHandler
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.viewModels
import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.paging.compose.LazyPagingItems
import androidx.paging.compose.collectAsLazyPagingItems
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.common.compose.Dropdown
import io.github.kunal26das.common.compose.statusBarHeight
import io.github.kunal26das.common.core.Activity
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.compose.CategorisedMovies
import io.github.kunal26das.yify.compose.SystemBarGradient
import io.github.kunal26das.yify.compose.TextSwitch
import io.github.kunal26das.yify.compose.VerticalGridMovies
import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.OrderBy
import io.github.kunal26das.yify.domain.model.Quality
import io.github.kunal26das.yify.domain.model.SortBy

@AndroidEntryPoint
class MoviesActivity : Activity() {

    private val viewModel by viewModels<MoviesViewModel>()
    private val movieActivity = registerForActivityResult(MovieActivity.Contract())
    private val genres = Genre.values().filter { it != Genre.Unknown }

    private lateinit var onBackPressedCallback: OnBackPressedCallback

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        viewModel.setGenres(genres)
    }

    @Composable
    override fun Content() {
        val drawerState = rememberDrawerState(DrawerValue.Closed)
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
                val uiPreference by viewModel.uiPreference.collectAsState()
                val categorizedMovies by viewModel.categorizedMovies.collectAsState()
                val uncategorizedMovies = viewModel.uncategorizedMovies.collectAsLazyPagingItems()
                val categorizedMoviePagingItems =
                    categorizedMovies.map { it.collectAsLazyPagingItems() }
                Column(modifier = Modifier.fillMaxSize()) {
                    when (uiPreference.preview) {
                        Preview.Categorised -> CategorisedMovies(
                            modifier = Modifier.fillMaxSize(),
                            genres = genres,
                            categorisedMovies = categorizedMoviePagingItems,
                        ) {
                            viewModel.setGenres(genres)
                        }

                        else -> UncategorisedMovies(
                            modifier = Modifier.fillMaxSize(),
                            movies = uncategorizedMovies,
                        )
                    }
                }
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
    private fun UncategorisedMovies(
        modifier: Modifier = Modifier,
        movies: LazyPagingItems<Movie>,
    ) {
        VerticalGridMovies(
            modifier = modifier,
            contentPadding = PaddingValues(
                vertical = statusBarHeight,
                horizontal = 5.dp,
            ),
            moviePadding = PaddingValues(5.dp),
            movies = movies,
        ) {
            movieActivity.launch(it?.id)
        }
    }

    @Composable
    private fun DrawerContent(
        modifier: Modifier = Modifier,
    ) {
        val uiPreference by viewModel.uiPreference.collectAsState()
        val contentModifier = Modifier.fillMaxWidth()
        Column(
            modifier = modifier.padding(
                vertical = statusBarHeight,
                horizontal = 16.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SearchTextField(modifier = contentModifier)
            AnimatedVisibility(
                modifier = contentModifier,
                visible = uiPreference.preview == Preview.Uncategorised,
            ) {
                GenreDropdown(modifier = contentModifier)
            }
            QualityDropdown(modifier = contentModifier)
            SortByDropdown(modifier = contentModifier)
            OrderBy(modifier = contentModifier)
            Preview(modifier = contentModifier)
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
            items = Genre.values().filter {
                it != Genre.Unknown
            },
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
            items = Quality.values().reversed().filter {
                it != Quality.Unknown
            },
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
            Text(text = stringResource(R.string.min_rating))
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
            showTrailingIcon = false,
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
        )
    }

    @Composable
    private fun OrderBy(
        modifier: Modifier = Modifier,
    ) {
        val moviePreference by viewModel.moviePreference.collectAsState()
        TextSwitch(
            modifier = modifier,
            checked = moviePreference.orderBy == OrderBy.Descending,
            text = stringResource(R.string.decreasing_order),
        ) {
            viewModel.setOrderBy(if (it) OrderBy.Descending else OrderBy.Ascending)
        }
    }

    @Composable
    private fun Preview(
        modifier: Modifier = Modifier,
    ) {
        val uiPreference by viewModel.uiPreference.collectAsState()
        TextSwitch(
            modifier = modifier,
            checked = uiPreference.preview == Preview.Categorised,
            text = stringResource(R.string.categorize),
        ) {
            viewModel.setUserInterface(if (it) Preview.Categorised else Preview.Uncategorised)
        }
    }

    @Composable
    private fun ClearButton(
        modifier: Modifier = Modifier,
    ) {
        OutlinedButton(
            modifier = modifier,
            onClick = { viewModel.clear() },
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
