package io.github.kunal26das.yify.movies.compose

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun ErrorState(
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            modifier = Modifier.padding(16.dp),
            text = "Something went wrong!",
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
            fontSize = 20.sp,
        )
        OutlinedButton(
            modifier = Modifier,
            onClick = {
//                activity.finishAffinity()
//                launcherActivity.launch(null)
            },
            content = {
                Text(
                    text = "Refresh",
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        )
    }
}