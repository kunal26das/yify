package io.github.kunal26das.yify.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.children
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.lifecycleScope
import com.google.android.material.chip.Chip
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ChipFilterBinding
import io.github.kunal26das.yify.databinding.FragmentFiltersBinding
import io.github.kunal26das.yify.models.OnChangeListener
import io.github.kunal26das.yify.models.OrderBy
import io.github.kunal26das.yify.models.Quality
import io.github.kunal26das.yify.models.SortBy
import io.github.kunal26das.yify.repository.Preference
import kotlinx.coroutines.launch

class FilterFragment : BottomSheetDialogFragment() {

    private val dataStore by dataStore()
    override val layoutId = R.layout.fragment_filters
    private val binding by dataBinding<FragmentFiltersBinding>()

    private var onChangeListener: OnChangeListener<*>? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        super.onCreateView(inflater, container, savedInstanceState)
        Quality.forEach { quality ->
            val radioButton = ChipFilterBinding.inflate(LayoutInflater.from(context)).chip
            radioButton.id = quality.hashCode()
            radioButton.text = quality
            binding.quality.addView(radioButton)
        }
        SortBy.forEach { sortBy ->
            val radioButton = ChipFilterBinding.inflate(LayoutInflater.from(context)).chip
            radioButton.id = sortBy.hashCode()
            radioButton.text = sortBy
            binding.sortBy.addView(radioButton)
        }
        OrderBy.forEach { orderBy ->
            val radioButton = ChipFilterBinding.inflate(LayoutInflater.from(context)).chip
            radioButton.id = orderBy.hashCode()
            radioButton.text = orderBy
            binding.orderBy.addView(radioButton)
        }
        lifecycleScope.launch {
            dataStore.get<String>(Preference.Quality)?.hashCode()?.let {
                binding.quality.check(it)
            }
            dataStore.get<Int>(Preference.MinimumRating)?.let {
                binding.rating.value = it.toFloat()
            }
            dataStore.get<String>(Preference.QueryTerm)?.let {
                binding.query.setText(it)
            }
            dataStore.get<String>(Preference.SortBy)?.hashCode()?.let {
                binding.sortBy.check(it)
            }
            dataStore.get<String>(Preference.OrderBy)?.hashCode()?.let {
                binding.orderBy.check(it)
            }
        }
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        binding.quality.setOnCheckedChangeListener { group, _ ->
            val quality = (group.children.firstOrNull {
                (it as Chip).isChecked
            } as? Chip)?.text.toString()
            lifecycleScope.launch {
                dataStore.set(Preference.Quality, quality)
                onChangeListener?.onChange(null)
            }
        }
        binding.rating.addOnChangeListener { _, value, fromUser ->
            if (fromUser) lifecycleScope.launch {
                dataStore.set(Preference.MinimumRating, value.toInt())
                onChangeListener?.onChange(null)
            }
        }
        binding.query.doAfterTextChanged {
            lifecycleScope.launch {
                dataStore.set(Preference.QueryTerm, it.toString())
                onChangeListener?.onChange(null)
            }
        }
        binding.sortBy.setOnCheckedChangeListener { group, _ ->
            val sortBy = (group.children.firstOrNull {
                (it as Chip).isChecked
            } as? Chip)?.text.toString()
            lifecycleScope.launch {
                dataStore.set(Preference.SortBy, sortBy)
                onChangeListener?.onChange(null)
            }
        }
        binding.orderBy.setOnCheckedChangeListener { group, _ ->
            val orderBy = (group.children.firstOrNull {
                (it as Chip).isChecked
            } as? Chip)?.text.toString()
            lifecycleScope.launch {
                dataStore.set(Preference.OrderBy, orderBy)
                onChangeListener?.onChange(null)
            }
        }
    }

    fun setOnFiltersChangeListener(
        onChangeListener: OnChangeListener<*>
    ) {
        this.onChangeListener = onChangeListener
    }

}