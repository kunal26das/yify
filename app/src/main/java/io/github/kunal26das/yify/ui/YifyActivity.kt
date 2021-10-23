package io.github.kunal26das.yify.ui

import androidx.activity.viewModels
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ActivityYifyBinding

class YifyActivity : Activity() {

    override val layoutId = R.layout.activity_yify
    private val viewModel by viewModels<YifyViewModel>()
    private val binding by dataBinding<ActivityYifyBinding>()

}
