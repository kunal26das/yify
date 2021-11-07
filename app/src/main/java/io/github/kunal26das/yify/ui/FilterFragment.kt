package io.github.kunal26das.yify.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.children
import com.google.android.material.chip.Chip
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ChipFilterBinding
import io.github.kunal26das.yify.databinding.FragmentFiltersBinding
import io.github.kunal26das.yify.models.Quality

class FilterFragment : BottomSheetDialogFragment() {

    override val layoutId = R.layout.fragment_filters
    private val binding by dataBinding<FragmentFiltersBinding>()

    private var onQualityChangeListener: Quality.OnChangeListener? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        super.onCreateView(inflater, container, savedInstanceState)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        Quality.forEach { quality ->
            val chip = ChipFilterBinding.inflate(LayoutInflater.from(context)).chip
            chip.text = quality
            binding.quality.addView(chip)
        }
        binding.quality.setOnCheckedChangeListener { group, checkedId ->
            onQualityChangeListener?.invoke(
                (group.children.firstOrNull {
                    (it as Chip).isChecked
                } as? Chip)?.text.toString()
            )
        }
    }

    fun setOnQualityChangeListener(
        onQualityChangeListener: Quality.OnChangeListener
    ) {
        this.onQualityChangeListener = onQualityChangeListener
    }

}