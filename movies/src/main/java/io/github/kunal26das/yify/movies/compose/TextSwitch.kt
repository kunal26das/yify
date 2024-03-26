package io.github.kunal26das.yify.movies.compose

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

@Composable
fun TextSwitch(
    modifier: Modifier = Modifier,
    checked: Boolean,
    text: String,
    onCheckChange: (Boolean) -> Unit,
) {
    var isChecked by remember { mutableStateOf(checked) }
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            modifier = Modifier
                .weight(1f)
                .clickable(
                    interactionSource = remember {
                        MutableInteractionSource()
                    },
                    indication = null,
                ) {
                    isChecked = isChecked.not()
                    onCheckChange.invoke(isChecked)
                },
            text = text,
        )
        Switch(
            checked = isChecked,
            onCheckedChange = {
                onCheckChange.invoke(it)
                isChecked = it
            }
        )
    }
}