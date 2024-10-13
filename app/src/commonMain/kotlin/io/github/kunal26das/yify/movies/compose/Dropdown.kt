package io.github.kunal26das.yify.movies.compose

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun <T> Dropdown(
    modifier: Modifier = Modifier,
    modifier2: Modifier = Modifier,
    label: String,
    enabled: Boolean = true,
    selection: T? = null,
    items: Iterable<T>,
    showTrailingIcon: Boolean = true,
    onSelect: (T?) -> Unit = {},
    onClear: () -> Unit = { onSelect.invoke(null) },
    shape: Shape = OutlinedTextFieldDefaults.shape,
    trailingIcon: @Composable () -> Unit = {
        if (showTrailingIcon) {
            IconButton(
                onClick = {
                    onClear.invoke()
                }
            ) {
                Icon(
                    imageVector = Icons.Filled.Clear,
                    contentDescription = null,
                )
            }
        }
    },
    name: (T) -> String? = { null },
) {
    val focusManager = LocalFocusManager.current
    var expanded by remember { mutableStateOf(false) }
    val keyboardController = LocalSoftwareKeyboardController.current
//    ExposedDropdownMenuBox(
//        modifier = modifier,
//        expanded = expanded,
//        onExpandedChange = {
//            expanded = it and enabled
//        }
//    ) {
        OutlinedTextField(
            modifier = modifier2
//                .menuAnchor(
//                    type = MenuAnchorType.PrimaryNotEditable,
//                    enabled = true
//                )
                .onFocusChanged {
                    keyboardController?.hide()
                    expanded = it.hasFocus and enabled
                },
            shape = shape,
            readOnly = true,
            enabled = enabled,
            value = selection?.let { name.invoke(it) }.orEmpty(),
            onValueChange = {},
            label = { Text(label) },
            trailingIcon = {
                if (showTrailingIcon) {
                    trailingIcon.invoke()
                }
            },
        )
//        ExposedDropdownMenu(
//            expanded = expanded,
//            onDismissRequest = {
//                expanded = false
//                focusManager.clearFocus()
//            }
//        ) {
//            items.forEach { option ->
//                DropdownMenuItem(
//                    text = { Text(text = name.invoke(option).orEmpty()) },
//                    onClick = {
//                        expanded = false
//                        onSelect.invoke(option)
//                        focusManager.clearFocus()
//                    }
//                )
//            }
//        }
//    }
}