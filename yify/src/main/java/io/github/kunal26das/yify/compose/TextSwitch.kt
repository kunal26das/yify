package io.github.kunal26das.yify.compose

import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

@Composable
fun TextSwitch(
    modifier: Modifier = Modifier,
    checked: Boolean,
    text: String,
    onCheckChange: (Boolean) -> Unit,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            modifier = Modifier.weight(1f),
            text = text,
        )
        Switch(
            checked = checked,
            onCheckedChange = onCheckChange
        )
    }
}