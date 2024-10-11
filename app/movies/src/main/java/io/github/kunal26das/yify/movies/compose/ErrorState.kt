package io.github.kunal26das.yify.movies.compose

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.kunal26das.common.compose.LocalActivity
import io.github.kunal26das.common.contract.LauncherContract
import io.github.kunal26das.yify.movies.R

@Composable
fun ErrorState(
    modifier: Modifier = Modifier,
) {
    val activity = LocalActivity.current
    val launcherActivity = rememberLauncherForActivityResult(LauncherContract()) { }
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            modifier = Modifier.padding(16.dp),
            text = stringResource(R.string.something_went_wrong),
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
            fontSize = 20.sp,
        )
        OutlinedButton(
            modifier = Modifier,
            onClick = {
                activity.finishAffinity()
                launcherActivity.launch(null)
            },
            content = {
                Text(
                    text = stringResource(R.string.refresh),
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        )
    }
}