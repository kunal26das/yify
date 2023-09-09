package io.github.kunal26das.yify.ui

import android.os.Bundle
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.common.core.Activity

@AndroidEntryPoint
class MainActivity : Activity() {

    private val homeActivity = registerForActivityResult(HomeActivity.Contract())
    private val netflixActivity = registerForActivityResult(NetflixActivity.Contract())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        netflixActivity.launch(null)
    }
}