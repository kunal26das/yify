package io.github.kunal26das.yify.movies.compose

import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import io.github.kunal26das.yify.movies.presentation.MoviesViewModel
import org.koin.compose.viewmodel.koinViewModel

@Composable
@OptIn(ExperimentalLayoutApi::class)
fun SearchTextField(
    modifier: Modifier = Modifier,
    viewModel: MoviesViewModel = koinViewModel(),
    shape: Shape = OutlinedTextFieldDefaults.shape,
    onFilterClick: () -> Unit = {},
) {
    val focusManager = LocalFocusManager.current
    var isFocused by remember { mutableStateOf(false) }
    val searchQuery by viewModel.searchQuery.collectAsState()
    val keyboardController = LocalSoftwareKeyboardController.current
    val isImeVisible = false // by rememberUpdatedState(WindowInsets.Companion.isImeVisible)

    LaunchedEffect(isImeVisible) {
        if (isImeVisible.not()) {
            focusManager.clearFocus(true)
        }
    }

    OutlinedTextField(
        modifier = modifier.onFocusChanged {
            isFocused = it.isFocused
        },
        readOnly = false,
        shape = shape,
        label = {
            if (isFocused.not() && searchQuery.isEmpty()) {
                Text(
                    modifier = Modifier.Companion
                        .fillMaxWidth()
                        .padding(start = 8.dp),
                    text = "Search",
                )
            }
        },
        trailingIcon = {
            if (searchQuery.isNotEmpty()) {
                IconButton(
                    modifier = Modifier.padding(end = 8.dp),
                    onClick = {
                        viewModel.search(null)
                        focusManager.clearFocus()
                    },
                    content = {
                        Icon(
                            imageVector = Icons.Filled.Clear,
                            contentDescription = null,
                        )
                    }
                )
            } else {
                IconButton(
                    modifier = Modifier.padding(end = 8.dp),
                    onClick = onFilterClick,
                    content = {
                        Icon(
                            imageVector = Icons.Filled.FilterList,
                            contentDescription = null,
                        )
                    }
                )
            }
        },
        value = searchQuery,
        onValueChange = {
            viewModel.search(it)
        },
        keyboardOptions = KeyboardOptions(
            imeAction = ImeAction.Companion.Search,
            autoCorrectEnabled = false,
        ),
        keyboardActions = KeyboardActions(
            onSearch = {
                keyboardController?.hide()
            }
        )
    )
}