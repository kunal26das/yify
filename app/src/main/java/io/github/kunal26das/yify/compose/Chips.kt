package io.github.kunal26das.yify.compose

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Chips(
    modifier: Modifier = Modifier,
    chips: List<String>,
    selected: String? = null,
    onClick: ((String) -> Unit)? = null
) {
    Row(
        modifier = modifier
    ) {
        chips.forEach {
            FilterChip(
                modifier = Modifier.padding(4.dp),
                label = { Text(text = it) },
                selected = it == selected,
                onClick = { onClick?.invoke(it) }
            )
        }
    }
}