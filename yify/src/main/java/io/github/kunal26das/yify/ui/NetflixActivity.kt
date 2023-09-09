package io.github.kunal26das.yify.ui

import android.content.Context
import android.content.Intent
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

    @Composable
    override fun Content() {
        val genres = Genre.values().toList()
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            content = {
                itemsIndexed(viewModel.getMovieGenreFlows(genres)) { index, flow ->
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Surface(
                            modifier = Modifier.padding(16.dp)
                        ) {
                            Text(
                                text = "${genres[index]}",
                                fontSize = 16.sp,
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