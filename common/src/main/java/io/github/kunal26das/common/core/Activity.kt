package io.github.kunal26das.common.core

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContract
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.Composable
import io.github.kunal26das.common.Theme

abstract class Activity : AppCompatActivity() {

    protected fun <I, O> registerForActivityResult(
        contract: ActivityResultContract<I, O>
    ) = registerForActivityResult(contract) {}

    @Composable
    open fun Content() = Unit

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            Theme {
                Content()
            }
        }
    }
}