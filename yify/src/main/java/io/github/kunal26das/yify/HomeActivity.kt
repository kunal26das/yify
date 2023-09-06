package io.github.kunal26das.yify

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.common.Activity
import io.github.kunal26das.yify.compose.Home

@AndroidEntryPoint
class HomeActivity : Activity() {
    @Composable
    override fun Content() {
        Home(
            modifier = Modifier
                .fillMaxSize(),
        )
    }
}
