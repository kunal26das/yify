package io.github.kunal26das.yify.presentation

import android.os.Bundle
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.common.core.Activity

@AndroidEntryPoint
class MainActivity : Activity() {

    private val moviesActivity = registerForActivityResult(MoviesActivity.Contract())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        moviesActivity.launch().finish()
    }
}