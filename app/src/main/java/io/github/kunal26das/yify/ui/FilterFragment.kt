package io.github.kunal26das.yify.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.children
import androidx.lifecycle.lifecycleScope
import com.google.android.material.chip.Chip
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ChipFilterBinding
import io.github.kunal26das.yify.databinding.FragmentFiltersBinding
import io.github.kunal26das.yify.models.OnChangeListener
import io.github.kunal26das.yify.models.Quality
import io.github.kunal26das.yify.repository.Preference
import kotlinx.coroutines.launch

class FilterFragment : BottomSheetDialogFragment() {

    private val dataStore by dataStore()
    override val layoutId = R.layout.fragment_filters
    private val binding by dataBinding<FragmentFiltersBinding>()

    private var onQualityChangeListener: OnChangeListener<String>? = null

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
            lifecycleScope.launch {
                chip.isChecked = quality == dataStore.get<String>(Preference.Quality)
            }
            chip.text = quality
            binding.quality.addView(chip)
        }
        binding.quality.setOnCheckedChangeListener { group, _ ->
            onQualityChangeListener?.onChange(
                (group.children.firstOrNull {
                    (it as Chip).isChecked
                } as? Chip)?.text.toString()
            )
        }
    }

    fun setOnQualityChangeListener(
        onQualityChangeListener: OnChangeListener<String>
    ) {
        this.onQualityChangeListener = onQualityChangeListener
    }

}