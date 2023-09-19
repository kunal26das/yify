package io.github.kunal26das.common.core

import android.os.Bundle
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContract
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.Composable
import io.github.kunal26das.common.compose.Theme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

abstract class Activity : AppCompatActivity() {

    protected fun <I, O> registerForActivityResult(
        contract: ActivityResultContract<I, O>
    ) = registerForActivityResult(contract) {}

    protected fun ActivityResultLauncher<*>.launch(): Activity {
        launch(null)
        return this@Activity
    }

    protected fun onBackPressedCallback(
        coroutineScope: CoroutineScope, onBackPressed: suspend () -> Unit = {}
    ): OnBackPressedCallback {
        return object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                coroutineScope.launch {
                    onBackPressed.invoke()
                }
            }
        }
    }

    protected fun addOnBackPressedDispatcherCallback(
        coroutineScope: CoroutineScope,
        callback: suspend () -> Unit = {},
    ) = onBackPressedCallback(coroutineScope, callback).also {
        onBackPressedDispatcher.addCallback(it)
    }

    @Composable
    open fun Content() = Unit

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            Theme {
                Content()
            }
        }
    }
}