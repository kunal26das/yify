import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  Genre,
  GENRE_OPTIONS,
  OrderBy,
  ORDER_OPTIONS,
  Quality,
  QUALITY_OPTIONS,
  RATING_OPTIONS,
  SortBy,
  SORT_BY_OPTIONS,
} from '@/presentation/movies/constants/movieFilterOptions';
import type { MovieFilters } from '@/presentation/movies/useMoviesViewModel';

interface MovieFilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: MovieFilters;
  onFiltersChange: (f: MovieFilters) => void;
  onApply: (filters: MovieFilters) => void;
  onClear: () => void;
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const textColor = useThemeColor({}, 'text');
  return (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: iconColor },
        selected && { backgroundColor: iconColor + '30' },
      ]}
    >
      <ThemedText
        style={[styles.chipLabel, { color: selected ? textColor : iconColor }]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function MovieFilterModal({
  visible,
  onClose,
  filters,
  onFiltersChange,
  onApply,
  onClear,
}: MovieFilterModalProps) {
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeColor({}, 'background');
  const iconColor = useThemeColor({}, 'icon');

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <ThemedView
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + 16,
              backgroundColor,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <ThemedText type="subtitle">Filters</ThemedText>
            <Pressable
              onPress={() => {
                onClear();
                onClose();
              }}
              hitSlop={12}
            >
              <ThemedText style={{ color: iconColor }}>Clear</ThemedText>
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <FilterSection title="Quality">
              <View style={styles.chipRow}>
                {QUALITY_OPTIONS.map(({ value, label }) => (
                  <Chip
                    key={value || 'all'}
                    label={label}
                    selected={(filters.quality ?? Quality.All) === value}
                    onPress={() =>
                      onFiltersChange({
                        ...filters,
                        quality: value === Quality.All ? undefined : value,
                      })
                    }
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="Minimum rating">
              <View style={styles.chipRow}>
                {RATING_OPTIONS.map(({ value, label }) => (
                  <Chip
                    key={value}
                    label={label}
                    selected={(filters.minimum_rating ?? 0) === value}
                    onPress={() =>
                      onFiltersChange({
                        ...filters,
                        minimum_rating: value === 0 ? undefined : value,
                      })
                    }
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="Genre">
              <View style={styles.chipRow}>
                {GENRE_OPTIONS.map(({ value, label }) => (
                  <Chip
                    key={value || 'all'}
                    label={label}
                    selected={(filters.genre ?? Genre.All) === value}
                    onPress={() =>
                      onFiltersChange({
                        ...filters,
                        genre: value === Genre.All ? undefined : value,
                      })
                    }
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="Sort by">
              <View style={styles.chipRow}>
                {SORT_BY_OPTIONS.map(({ value, label }) => (
                  <Chip
                    key={value}
                    label={label}
                    selected={(filters.sort_by ?? SortBy.DateAdded) === value}
                    onPress={() =>
                      onFiltersChange({
                        ...filters,
                        sort_by: value,
                      })
                    }
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="Order">
              <View style={styles.chipRow}>
                {ORDER_OPTIONS.map(({ value, label }) => (
                  <Chip
                    key={value}
                    label={label}
                    selected={(filters.order_by ?? OrderBy.Desc) === value}
                    onPress={() =>
                      onFiltersChange({
                        ...filters,
                        order_by: value,
                      })
                    }
                  />
                ))}
              </View>
            </FilterSection>
          </ScrollView>
          <View style={[styles.footer, { paddingHorizontal: 16 }]}>
            <Pressable
              onPress={handleApply}
              style={({ pressed }) => [
                styles.applyButton,
                { backgroundColor: iconColor, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={styles.applyButtonLabel}>Apply filters</Text>
            </Pressable>
          </View>
        </ThemedView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.5)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  scroll: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    opacity: 0.8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 14,
  },
  footer: {
    paddingTop: 12,
  },
  applyButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
