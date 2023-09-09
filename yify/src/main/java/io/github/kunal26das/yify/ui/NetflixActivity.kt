package io.github.kunal26das.yify.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.common.core.Activity
import io.github.kunal26das.yify.compose.HorizontalMovies
import io.github.kunal26das.yify.domain.model.Genre

@AndroidEntryPoint
class NetflixActivity : Activity() {

    private val viewModel by viewModels<NetflixViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        viewModel.getMovieGenreCounts(Genre.ALL)
    }

    @Composable
    override fun Content() {
        val movieGenreCounts by viewModel.movieGenreCount.collectAsState()
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 4.dp, bottom = 8.dp),
            content = {
                itemsIndexed(viewModel.getMovieGenreFlows(Genre.ALL)) { index, flow ->
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Surface {
                            Text(
                                modifier = Modifier.padding(
                                    start = 26.dp,
                                    top = 12.dp,
                                    end = 26.dp,
                                    bottom = 12.dp,
                                ),
                                text = when (movieGenreCounts.getOrNull(index)) {
                                    null -> Genre.ALL[index].name
                                    else -> "${Genre.ALL[index]} (${movieGenreCounts[index]})"
                                },
                                fontSize = 20.sp,
                            )
                        }
                        HorizontalMovies(
                            modifier = Modifier.fillMaxWidth(),
                            moviesFlow = flow,
                        )
                    }
                }
            }
        )
    }

    class Contract : ActivityResultContract<Any?, Boolean>() {
        override fun createIntent(context: Context, input: Any?): Intent {
            return Intent(context, NetflixActivity::class.java)
        }

        override fun parseResult(resultCode: Int, intent: Intent?): Boolean {
            return resultCode == RESULT_OK
        }
    }
}