package io.github.kunal26das.yify.core

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContract
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.Composable
import io.github.kunal26das.yify.theme.YifyTheme

abstract class ComposeActivity : AppCompatActivity() {

    fun <I, O> registerForActivityResult(
        contract: ActivityResultContract<I, O>,
    ) = registerForActivityResult(contract) {}

    @Composable
    abstract fun Content()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            YifyTheme {
                Content()
            }
        }
    }
}