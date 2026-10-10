# Spec Delta

## Purpose

Make existing search, headings, dialogs and action controls understandable and usable across screen sizes and assistive technologies.

## ADDED Requirements

### Requirement: Search can reset its applied query
Mobile and desktop search SHALL allow clearing the applied query without resetting other filters. Empty queries SHALL NOT be saved as recent searches.

#### Scenario: Mobile search reset
- **WHEN** the user clears an active search and submits the empty query
- **THEN** the query filter clears, other selected filters remain, and no empty recent item is added

### Requirement: Existing controls communicate their purpose
Dialog close labels and preference copy SHALL describe the current context and visible controls. Actual page and section headings SHALL expose heading semantics without treating metric values as headings.

#### Scenario: Journal dialog
- **WHEN** assistive technology encounters a journal dialog's close button
- **THEN** its label identifies the journal context rather than watchlist controls

#### Scenario: Heading navigation
- **WHEN** a user navigates a page by headings
- **THEN** actual headings appear in the accessibility tree and numeric summary values do not become headings solely because of their font size

### Requirement: Compact actions accommodate text and touch
Existing history and movie action controls SHALL have at least 44 logical pixels of target height and grow to contain enlarged labels without clipping.

#### Scenario: Larger text
- **WHEN** the user increases text size on a narrow screen
- **THEN** action labels remain contained and operable without overlapping adjacent controls
