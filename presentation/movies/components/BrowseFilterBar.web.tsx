import {useState} from 'react';
import {Genre, OrderBy, Quality, SortBy} from '@/domain';
import {FontFamily, Fonts, Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {useResponsive} from '../../hooks/use-responsive';
import {GENRE_OPTIONS, ORDER_OPTIONS, QUALITY_OPTIONS, RATING_OPTIONS, SORT_BY_OPTIONS} from '../constants/movieFilterLabels';
import {BrowseFilterBarContent, type BrowseFilterBarProps} from './BrowseFilterBar.shared';

export type {BrowseFilterBarProps} from './BrowseFilterBar.shared';

function BrowseSelect<T extends string | number>({label, value, options, onChange}: {
    label: string;
    value: T;
    options: {value: T; label: string}[];
    onChange: (value: T) => void;
}) {
    const {colors, scheme} = usePalette();
    const [focused, setFocused] = useState(false);
    return (
        <label style={{display: 'flex', flexDirection: 'column', gap: Spacing.sm, flex: '1 1 120px', minWidth: 120,
            color: colors.textMuted, fontFamily: `${FontFamily.medium}, ${Fonts.sans}`, fontSize: 13, lineHeight: '18px'}}>
            {label}
            <select value={String(value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                onChange={event => {
                    const selected = options.find(option => String(option.value) === event.currentTarget.value);
                    if (selected) onChange(selected.value);
                }}
                style={{boxSizing: 'border-box', width: '100%', minHeight: 44, padding: '10px 12px',
                    backgroundColor: colors.surface, color: colors.text, colorScheme: scheme,
                    border: `1px solid ${focused ? colors.accent : colors.borderStrong}`, borderRadius: Radius.sm,
                    outline: focused ? `2px solid ${colors.accent}` : undefined, outlineOffset: 2,
                    fontFamily: `${FontFamily.regular}, ${Fonts.sans}`, fontSize: 14, cursor: 'pointer'}}>
                {options.map(option => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
            </select>
        </label>
    );
}

export function BrowseFilterBar(props: BrowseFilterBarProps) {
    const {width} = useResponsive();
    const {filters, onChange} = props;
    if (width < 768) return <BrowseFilterBarContent {...props}/>;

    return (
        <BrowseFilterBarContent {...props}>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: Spacing.md}}>
                <BrowseSelect label="Quality" options={QUALITY_OPTIONS} value={filters.quality ?? Quality.All}
                    onChange={quality => onChange({...filters, quality: quality || undefined})}/>
                <BrowseSelect label="Genre" options={GENRE_OPTIONS} value={filters.genre ?? Genre.All}
                    onChange={genre => onChange({...filters, genre: genre || undefined})}/>
                <BrowseSelect label="Minimum rating" options={RATING_OPTIONS} value={filters.minimum_rating ?? 0}
                    onChange={minimum_rating => onChange({...filters, minimum_rating: minimum_rating || undefined})}/>
                <BrowseSelect label="Sort by" options={SORT_BY_OPTIONS} value={filters.sort_by ?? SortBy.DateAdded}
                    onChange={sort_by => onChange({...filters, sort_by})}/>
                <BrowseSelect label="Order" options={ORDER_OPTIONS} value={filters.order_by ?? OrderBy.Desc}
                    onChange={order_by => onChange({...filters, order_by})}/>
            </div>
        </BrowseFilterBarContent>
    );
}
