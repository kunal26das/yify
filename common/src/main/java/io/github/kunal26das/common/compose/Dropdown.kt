package io.github.kunal26das.common.compose

import androidx.compose.foundation.clickable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController

@Composable
@OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)
fun <T> Dropdown(
    modifier: Modifier = Modifier,
    modifier2: Modifier = Modifier,
    label: String,
    enabled: Boolean = true,
    selection: T? = null,
    items: Iterable<T>,
    name: (T) -> String? = { null },
    onSelect: (T?) -> Unit = {},
) {
    val focusManager = LocalFocusManager.current
    var expanded by remember { mutableStateOf(false) }
    val keyboardController = LocalSoftwareKeyboardController.current
    ExposedDropdownMenuBox(
        modifier = modifier,
        expanded = expanded,
        onExpandedChange = {
            expanded = it and enabled
        }
    ) {
        OutlinedTextField(
            modifier = modifier2
                .menuAnchor()
                .onFocusChanged {
                    keyboardController?.hide()
                    expanded = it.hasFocus and enabled
                },
            readOnly = true,
            enabled = enabled,
            value = selection?.let { name.invoke(it) }.orEmpty(),
            onValueChange = {},
            label = { Text(label) },
            trailingIcon = {
                Icon(
                    modifier = Modifier.clickable {
                        onSelect.invoke(null)
                    },
                    imageVector = Icons.Filled.Clear,
                    contentDescription = null,
                )
            },
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = {
                expanded = false
                focusManager.clearFocus()
            }
        ) {
            items.forEach { option ->
                DropdownMenuItem(
                    text = { Text(text = name.invoke(option).orEmpty()) },
                    onClick = {
                        expanded = false
                        onSelect.invoke(option)
                        focusManager.clearFocus()
                    }
                )
            }
        }
    }
}