package io.github.kunal26das.yify.core

import android.os.Bundle
import android.os.PersistableBundle
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContract
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.Composable

abstract class ComposeActivity : AppCompatActivity() {

    fun <I, O> registerForActivityResult(
        contract: ActivityResultContract<I, O>,
    ) = registerForActivityResult(contract) {}

    @Composable
    abstract fun setContent()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { setContent() }
    }
}