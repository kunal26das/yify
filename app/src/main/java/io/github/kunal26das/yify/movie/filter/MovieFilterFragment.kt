package io.github.kunal26das.yify.movie.filter

import android.os.Bundle
import android.view.View
import androidx.core.view.children
import androidx.core.widget.doAfterTextChanged
import com.google.android.material.chip.Chip
import io.github.kunal26das.model.*
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.core.BottomSheetDialogFragment
import io.github.kunal26das.yify.databinding.ChipFilterBinding
import io.github.kunal26das.yify.databinding.FragmentFiltersBinding
import io.github.kunal26das.yify.preference.MoviePreferences
import javax.inject.Inject

class MovieFilterFragment : BottomSheetDialogFragment() {

    override val layout = R.layout.fragment_filters
    override val binding by dataBinding<FragmentFiltersBinding>()

    @Inject
    lateinit var moviePreferences: MoviePreferences
    private var onChangeListener: OnChangeListener<*>? = null

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        Quality.forEach { quality ->
            val chip = ChipFilterBinding.inflate(layoutInflater).chip
            chip.id = quality.hashCode()
            chip.text = quality
            binding.quality.addView(chip)
        }
        Genre.forEach { sortBy ->
            val chip = ChipFilterBinding.inflate(layoutInflater).chip
            chip.id = sortBy.hashCode()
            chip.text = sortBy
            binding.genre.addView(chip)
        }
        SortBy.forEach { sortBy ->
            val chip = ChipFilterBinding.inflate(layoutInflater).chip
            chip.id = sortBy.hashCode()
            chip.text = sortBy
            binding.sortBy.addView(chip)
        }
        OrderBy.forEach { orderBy ->
            val chip = ChipFilterBinding.inflate(layoutInflater).chip
            chip.id = orderBy.hashCode()
            chip.text = orderBy
            binding.orderBy.addView(chip)
        }
        moviePreferences.getString(Preference.quality)?.hashCode()?.let {
            binding.quality.check(it)
        }
        moviePreferences.getInt(Preference.minimum_rating)?.let {
            binding.rating.value = it.toFloat()
        }
        moviePreferences.getString(Preference.query_term)?.let {
            binding.query.setText(it)
        }
        moviePreferences.getString(Preference.genre)?.hashCode()?.let {
            binding.genre.check(it)
        }
        moviePreferences.getString(Preference.sort_by)?.hashCode()?.let {
            binding.sortBy.check(it)
        }
        moviePreferences.getString(Preference.order_by)?.hashCode()?.let {
            binding.orderBy.check(it)
        }
        binding.quality.setOnCheckedStateChangeListener { group, _ ->
            val quality = (group.children.firstOrNull {
                (it as Chip).isChecked
            } as? Chip)?.text.toString()
            moviePreferences[Preference.quality] = quality
            onChangeListener?.invoke(null)
        }
        binding.rating.addOnChangeListener { _, value, fromUser ->
            if (fromUser) {
                moviePreferences[Preference.minimum_rating] = value.toInt()
                onChangeListener?.invoke(null)
            }
        }
        binding.query.doAfterTextChanged {
            moviePreferences[Preference.query_term] = it.toString()
            onChangeListener?.invoke(null)
        }
        binding.genre.setOnCheckedStateChangeListener { group, _ ->
            val genre = (group.children.firstOrNull {
                (it as Chip).isChecked
            } as? Chip)?.text.toString()
            moviePreferences[Preference.genre] = genre
            onChangeListener?.invoke(null)
        }
        binding.sortBy.setOnCheckedStateChangeListener { group, _ ->
            val sortBy = (group.children.firstOrNull {
                (it as Chip).isChecked
            } as? Chip)?.text.toString()
            moviePreferences[Preference.sort_by] = sortBy
            onChangeListener?.invoke(null)
        }
        binding.orderBy.setOnCheckedStateChangeListener { group, _ ->
            val orderBy = (group.children.firstOrNull {
                (it as Chip).isChecked
            } as? Chip)?.text.toString()
            moviePreferences[Preference.order_by] = orderBy
            onChangeListener?.invoke(null)
        }
    }

    fun setOnFiltersChangeListener(
        onChangeListener: OnChangeListener<*>
    ) {
        this.onChangeListener = onChangeListener
    }

}